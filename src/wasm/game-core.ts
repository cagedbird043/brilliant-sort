import createBrilliantSortCoreModule, {
  type EmscriptenCoreModule,
} from "./generated/brilliant-sort-core.mjs";
import type {
  CoreTransition,
  GameCoreFactory as GameCoreFactoryPort,
  GameCorePort,
  GameCommand,
  GameState,
  LevelSpec,
} from "../core";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface ProtocolErrorEnvelope {
  readonly schemaVersion: 1;
  readonly error: {
    readonly code: string;
    readonly detail: string;
  };
}

export class CoreProtocolError extends Error {
  constructor(
    readonly code: string,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "CoreProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProtocolError(value: unknown): value is ProtocolErrorEnvelope {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.detail === "string"
  );
}

function parseTransition(json: string): CoreTransition {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new CoreProtocolError(
      "invalid-transition-json",
      error instanceof Error ? error.message : "Core returned invalid JSON",
    );
  }

  if (isProtocolError(value)) {
    throw new CoreProtocolError(value.error.code, value.error.detail);
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.state) ||
    !Array.isArray(value.events) ||
    !(value.rejection === null || isRecord(value.rejection)) ||
    typeof value.canonicalDump !== "string"
  ) {
    throw new CoreProtocolError("invalid-transition", "Core returned an invalid transition envelope");
  }
  return value as unknown as CoreTransition;
}

export class WasmGameCore implements GameCorePort {
  private handle: number | null;
  private state: GameState;

  private constructor(
    private readonly module: EmscriptenCoreModule,
    handle: number,
    initial: CoreTransition,
  ) {
    this.handle = handle;
    this.state = initial.state;
  }

  static async load(level: LevelSpec): Promise<WasmGameCore> {
    const wasmUrl = new URL("./generated/brilliant-sort-core.wasm", import.meta.url).href;
    const module = await createBrilliantSortCoreModule({
      locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path),
    });
    const levelJson = JSON.stringify(level);
    const handle = WasmGameCore.withUtf8(module, levelJson, (pointer, length) =>
      module._bs_core_create(pointer, length),
    );
    if (handle === 0) {
      throw new CoreProtocolError("create-failed", "Core could not allocate a session");
    }

    try {
      const initial = parseTransition(WasmGameCore.readResult(module, handle));
      return new WasmGameCore(module, handle, initial);
    } catch (error) {
      module._bs_core_destroy(handle);
      throw error;
    }
  }

  dispatch(command: GameCommand): CoreTransition {
    const handle = this.requireHandle();
    const status = WasmGameCore.withUtf8(this.module, JSON.stringify(command), (pointer, length) =>
      this.module._bs_core_dispatch(handle, pointer, length),
    );
    const transition = parseTransition(WasmGameCore.readResult(this.module, handle));
    if (status !== 0) {
      throw new CoreProtocolError(
        "dispatch-failed",
        `Core dispatch returned status ${status} without a protocol error envelope`,
      );
    }
    this.state = transition.state;
    return transition;
  }

  snapshot(): GameState {
    this.requireHandle();
    return this.state;
  }

  restart(): CoreTransition {
    return this.dispatch({ type: "restart-level" });
  }

  destroy(): void {
    if (this.handle === null) {
      return;
    }
    this.module._bs_core_destroy(this.handle);
    this.handle = null;
  }

  private requireHandle(): number {
    if (this.handle === null) {
      throw new CoreProtocolError("destroyed-core", "Core session has already been destroyed");
    }
    return this.handle;
  }

  private static withUtf8<T>(
    module: EmscriptenCoreModule,
    value: string,
    operation: (pointer: number, length: number) => T,
  ): T {
    const bytes = encoder.encode(value);
    if (bytes.length === 0) {
      return operation(0, 0);
    }
    const pointer = module._malloc(bytes.length);
    if (pointer === 0) {
      throw new CoreProtocolError("out-of-memory", "Core input allocation failed");
    }
    try {
      module.HEAPU8.set(bytes, pointer);
      return operation(pointer, bytes.length);
    } finally {
      module._free(pointer);
    }
  }

  private static readResult(module: EmscriptenCoreModule, handle: number): string {
    const length = module._bs_core_result_length(handle);
    if (!Number.isSafeInteger(length) || length <= 0) {
      throw new CoreProtocolError("missing-result", "Core returned an empty result buffer");
    }
    const pointer = module._malloc(length);
    if (pointer === 0) {
      throw new CoreProtocolError("out-of-memory", "Core result allocation failed");
    }
    try {
      const copied = module._bs_core_copy_result(handle, pointer, length);
      if (copied !== length) {
        throw new CoreProtocolError("copy-failed", "Core result buffer was not copied completely");
      }
      return decoder.decode(module.HEAPU8.subarray(pointer, pointer + length));
    } finally {
      module._free(pointer);
    }
  }
}

export const GameCoreFactory: GameCoreFactoryPort = {
  load: WasmGameCore.load,
};
