import processorUrl from "./pixel-audio-processor.js?worker&url";
import audioWasmUrl from "./generated/brilliant-sort-audio.wasm?url";
import { encodeAudioCue, type AudioCue } from "./contracts";

export type PixelAudioStatus = "loading" | "ready" | "running" | "suspended" | "failed";

export interface PixelAudioSnapshot {
  readonly status: PixelAudioStatus;
  readonly muted: boolean;
}

const MUTE_STORAGE_KEY = "brilliant-sort:audio-muted";

export class BrowserPixelAudioPort {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private preparePromise: Promise<void> | null = null;
  private readonly pendingCues: ArrayBuffer[] = [];
  private readonly listeners = new Set<(snapshot: PixelAudioSnapshot) => void>();
  private status: PixelAudioStatus = "loading";
  private muted = false;
  private destroyed = false;

  constructor() {
    try {
      this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
    } catch {
      this.muted = false;
    }
  }

  snapshot(): PixelAudioSnapshot {
    return { status: this.status, muted: this.muted };
  }

  subscribe(listener: (snapshot: PixelAudioSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  prepare(): Promise<void> {
    if (this.preparePromise !== null) {
      return this.preparePromise;
    }
    this.preparePromise = this.initialize().catch((error) => {
      if (!this.destroyed) {
        console.warn("Pixel audio disabled:", error);
        this.status = "failed";
        this.notify();
      }
    });
    return this.preparePromise;
  }

  resumeFromGesture(): void {
    if (this.destroyed) {
      return;
    }
    const context = this.ensureContext();
    void context.resume().then(() => {
      if (this.status !== "failed") {
        this.status = "running";
        this.notify();
      }
    }).catch(() => {
      this.status = "failed";
      this.notify();
    });
    void this.prepare();
  }

  pushCue(cue: AudioCue): void {
    if (this.destroyed || this.status === "failed") {
      return;
    }
    const encoded = encodeAudioCue(cue);
    const bytes = new ArrayBuffer(encoded.byteLength);
    new Uint8Array(bytes).set(encoded);
    if (this.node === null) {
      if (this.pendingCues.length < 64) {
        this.pendingCues.push(bytes);
      }
      return;
    }
    this.node.port.postMessage({ type: "cue", bytes }, [bytes]);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    } catch {
      // Persistence is optional; audio behavior remains available for this page.
    }
    this.node?.port.postMessage({ type: "mute", muted });
    this.notify();
  }

  destroy(): void {
    this.destroyed = true;
    this.pendingCues.length = 0;
    this.node?.disconnect();
    this.node = null;
    if (this.context !== null) {
      void this.context.close();
      this.context = null;
    }
    this.listeners.clear();
  }

  private ensureContext(): AudioContext {
    if (this.context === null) {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.context.addEventListener("statechange", () => {
        if (this.status === "failed") {
          return;
        }
        this.status = this.context?.state === "running" ? "running" : "suspended";
        this.notify();
      });
    }
    return this.context;
  }

  private async initialize(): Promise<void> {
    const context = this.ensureContext();
    const wasmRequest = fetch(audioWasmUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Audio WASM request failed: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((bytes) => WebAssembly.compile(bytes));
    const [wasmModule] = await Promise.all([
      wasmRequest,
      context.audioWorklet.addModule(processorUrl),
    ]);
    if (this.destroyed) {
      return;
    }

    const node = new AudioWorkletNode(context, "brilliant-sort-pixel-audio", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      processorOptions: { wasmModule },
    });
    this.node = node;
    node.onprocessorerror = () => {
      this.status = "failed";
      this.notify();
    };
    node.port.onmessage = (event: MessageEvent<{ readonly type?: string; readonly message?: string }>) => {
      if (event.data.type === "ready") {
        node.port.postMessage({ type: "mute", muted: this.muted });
        for (const bytes of this.pendingCues.splice(0)) {
          node.port.postMessage({ type: "cue", bytes }, [bytes]);
        }
        this.status = context.state === "running" ? "running" : "ready";
        this.notify();
      } else if (event.data.type === "error") {
        console.warn("Pixel audio worklet disabled:", event.data.message ?? "unknown worklet error");
        this.status = "failed";
        this.notify();
      }
    };
    node.connect(context.destination);
    this.status = context.state === "running" ? "running" : "ready";
    this.notify();
  }

  private notify(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
let sharedPixelAudioPort: BrowserPixelAudioPort | null = null;

export function getBrowserPixelAudioPort(): BrowserPixelAudioPort {
  sharedPixelAudioPort ??= new BrowserPixelAudioPort();
  return sharedPixelAudioPort;
}
