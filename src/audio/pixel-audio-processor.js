const MAX_FRAMES = 128;
const OUTPUT_CHANNELS = 2;
const CUE_BYTES = 12;

class BrilliantSortPixelAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.exports = null;
    this.handle = 0;
    this.outputPointer = 0;
    this.cuePointer = 0;
    this.heapU8 = null;
    this.outputView = null;
    this.port.onmessage = (event) => this.applyMessage(event.data);
    try {
      const wasmModule = options.processorOptions?.wasmModule;
      if (!(wasmModule instanceof WebAssembly.Module)) {
        throw new TypeError("Audio processor requires a compiled WebAssembly.Module");
      }
      const instance = new WebAssembly.Instance(wasmModule, {});
      this.exports = instance.exports;
      this.exports._initialize();
      this.handle = this.exports.bs_audio_worklet_create(Math.round(sampleRate));
      this.outputPointer = this.exports.malloc(
        MAX_FRAMES * OUTPUT_CHANNELS * Float32Array.BYTES_PER_ELEMENT,
      );
      this.cuePointer = this.exports.malloc(CUE_BYTES);
      this.heapU8 = new Uint8Array(this.exports.memory.buffer);
      this.outputView = new Float32Array(
        this.exports.memory.buffer,
        this.outputPointer,
        MAX_FRAMES * OUTPUT_CHANNELS,
      );
      this.port.postMessage({ type: "ready" });
    } catch (error) {
      this.port.postMessage({ type: "error", message: String(error) });
    }
  }

  applyMessage(message) {
    if (this.exports === null || this.handle === 0 || !message) {
      return;
    }
    if (message.type === "cue" && message.bytes instanceof ArrayBuffer) {
      this.heapU8.set(new Uint8Array(message.bytes, 0, CUE_BYTES), this.cuePointer);
      this.exports.bs_audio_worklet_push_cue(this.handle, this.cuePointer);
    } else if (message.type === "mute") {
      this.exports.bs_audio_worklet_set_muted(this.handle, message.muted ? 1 : 0);
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (output === undefined || output.length === 0) {
      return true;
    }
    const frames = output[0].length;
    if (
      this.exports === null ||
      this.handle === 0 ||
      this.outputView === null ||
      frames > MAX_FRAMES ||
      output.length > OUTPUT_CHANNELS
    ) {
      for (const channel of output) {
        channel.fill(0);
      }
      return true;
    }

    this.exports.bs_audio_worklet_render(this.handle, this.outputPointer, frames, output.length);
    for (let channel = 0; channel < output.length; channel += 1) {
      const destination = output[channel];
      for (let frame = 0; frame < frames; frame += 1) {
        destination[frame] = this.outputView[frame * output.length + channel];
      }
    }
    return true;
  }
}

registerProcessor("brilliant-sort-pixel-audio", BrilliantSortPixelAudioProcessor);
