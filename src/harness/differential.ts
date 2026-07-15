import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalDump,
  createGameState,
  reduce,
  type CoreTransition,
  type GameCommand,
  type GameEvent,
  type GameState,
  type LevelSpec,
  type Rejection,
} from "../core";
import { GameCoreFactory } from "../wasm/game-core";

export interface DifferentialScenario {
  readonly name: string;
  readonly level: LevelSpec;
  readonly commands: readonly GameCommand[];
}

export interface DifferentialDiagnostic {
  readonly scenario: string;
  readonly commandIndex: number;
  readonly command: string;
  readonly backend: "native" | "wasm";
  readonly expectedBefore: string;
  readonly actualBefore: string;
  readonly expectedAfter: string;
  readonly actualAfter: string;
  readonly firstMismatch: string | null;
  readonly expectedEvents: readonly GameEvent[];
  readonly actualEvents: readonly GameEvent[];
  readonly expectedRejection: Rejection | null;
  readonly actualRejection: Rejection | null;
}

export class DifferentialMismatchError extends Error {
  constructor(readonly diagnostic: DifferentialDiagnostic) {
    super(
      `${diagnostic.scenario} command ${diagnostic.commandIndex} diverged in ${diagnostic.backend}`,
    );
    this.name = "DifferentialMismatchError";
  }
}

export interface DifferentialReplayResult {
  readonly scenario: string;
  readonly initial: string;
  readonly final: string;
  readonly commandCount: number;
}

export interface DifferentialOptions {
  readonly nativeExecutable?: string;
}

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNativeTransition(line: string): CoreTransition {
  const value: unknown = JSON.parse(line);
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.state) ||
    !Array.isArray(value.events) ||
    !(value.rejection === null || isRecord(value.rejection)) ||
    typeof value.canonicalDump !== "string"
  ) {
    throw new Error(`Native core returned an invalid transition envelope: ${line}`);
  }
  return value as unknown as CoreTransition;
}

function firstJsonMismatch(
  expected: unknown,
  actual: unknown,
  path = "$",
): string | null {
  if (Object.is(expected, actual)) {
    return null;
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return `${path}.length: ${expected.length} !== ${actual.length}`;
    }
    for (let index = 0; index < expected.length; index += 1) {
      const mismatch = firstJsonMismatch(expected[index], actual[index], `${path}[${index}]`);
      if (mismatch !== null) {
        return mismatch;
      }
    }
    return null;
  }
  if (isRecord(expected) && isRecord(actual)) {
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
      return `${path} keys: ${JSON.stringify(expectedKeys)} !== ${JSON.stringify(actualKeys)}`;
    }
    for (const key of expectedKeys) {
      const mismatch = firstJsonMismatch(expected[key], actual[key], `${path}.${key}`);
      if (mismatch !== null) {
        return mismatch;
      }
    }
    return null;
  }
  return `${path}: ${JSON.stringify(expected)} !== ${JSON.stringify(actual)}`;
}

function asReferenceTransition(
  state: GameState,
  command: GameCommand,
  initial: GameState,
): CoreTransition {
  const result = reduce(state, command, initial);
  return {
    schemaVersion: 1,
    state: result.nextState,
    events: result.events,
    rejection: result.rejection ?? null,
    canonicalDump: canonicalDump(result.nextState),
  };
}

function transitionsMatch(expected: CoreTransition, actual: CoreTransition): boolean {
  return (
    expected.canonicalDump === actual.canonicalDump &&
    JSON.stringify(expected.events) === JSON.stringify(actual.events) &&
    JSON.stringify(expected.rejection) === JSON.stringify(actual.rejection)
  );
}

function assertTransition(
  scenario: DifferentialScenario,
  commandIndex: number,
  command: GameCommand,
  backend: DifferentialDiagnostic["backend"],
  expectedBefore: string,
  actualBefore: string,
  expected: CoreTransition,
  actual: CoreTransition,
): void {
  if (transitionsMatch(expected, actual)) {
    return;
  }
  const firstMismatch =
    expected.canonicalDump === actual.canonicalDump
      ? null
      : firstJsonMismatch(JSON.parse(expected.canonicalDump), JSON.parse(actual.canonicalDump));
  throw new DifferentialMismatchError({
    scenario: scenario.name,
    commandIndex,
    command: JSON.stringify(command),
    backend,
    expectedBefore,
    actualBefore,
    expectedAfter: expected.canonicalDump,
    actualAfter: actual.canonicalDump,
    firstMismatch,
    expectedEvents: expected.events,
    actualEvents: actual.events,
    expectedRejection: expected.rejection,
    actualRejection: actual.rejection,
  });
}

async function runNativeReplay(
  scenario: DifferentialScenario,
  executable: string,
): Promise<readonly CoreTransition[]> {
  const directory = await mkdtemp(join(tmpdir(), "brilliant-sort-differential-"));
  const levelPath = join(directory, "level.json");
  await Bun.write(levelPath, JSON.stringify(scenario.level));
  try {
    const stdin = `${scenario.commands.map((command) => JSON.stringify(command)).join("\n")}\n`;
    const process = Bun.spawn([executable, "--level", levelPath], {
      stdin: encoder.encode(stdin),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);
    if (exitCode !== 0) {
      throw new Error(`Native core replay failed (${exitCode}): ${stderr}`);
    }
    const lines = stdout.split("\n").filter((line) => line.length > 0);
    if (lines.length !== scenario.commands.length + 1) {
      throw new Error(
        `Native core emitted ${lines.length} transitions for ${scenario.commands.length} commands`,
      );
    }
    return lines.map(parseNativeTransition);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function replayDifferential(
  scenario: DifferentialScenario,
  options: DifferentialOptions = {},
): Promise<DifferentialReplayResult> {
  const nativeExecutable =
    options.nativeExecutable ?? join(process.cwd(), ".cache", "cmake", "brilliant_sort_core_cli");
  const initial = createGameState(scenario.level);
  const initialDump = canonicalDump(initial);
  const [nativeTransitions, wasm] = await Promise.all([
    runNativeReplay(scenario, nativeExecutable),
    GameCoreFactory.load(scenario.level),
  ]);

  try {
    const nativeInitial = nativeTransitions[0];
    if (nativeInitial?.canonicalDump !== initialDump) {
      throw new DifferentialMismatchError({
        scenario: scenario.name,
        commandIndex: -1,
        command: "initial",
        backend: "native",
        expectedBefore: initialDump,
        actualBefore: nativeInitial?.canonicalDump ?? "",
        expectedAfter: initialDump,
        actualAfter: nativeInitial?.canonicalDump ?? "",
        firstMismatch: nativeInitial
          ? firstJsonMismatch(JSON.parse(initialDump), JSON.parse(nativeInitial.canonicalDump))
          : "missing native initial transition",
        expectedEvents: [],
        actualEvents: nativeInitial?.events ?? [],
        expectedRejection: null,
        actualRejection: nativeInitial?.rejection ?? null,
      });
    }

    let reference = initial;
    let nativeBefore = nativeInitial.canonicalDump;
    let wasmBefore = canonicalDump(wasm.snapshot());
    if (wasmBefore !== initialDump) {
      throw new DifferentialMismatchError({
        scenario: scenario.name,
        commandIndex: -1,
        command: "initial",
        backend: "wasm",
        expectedBefore: initialDump,
        actualBefore: wasmBefore,
        expectedAfter: initialDump,
        actualAfter: wasmBefore,
        firstMismatch: firstJsonMismatch(JSON.parse(initialDump), JSON.parse(wasmBefore)),
        expectedEvents: [],
        actualEvents: [],
        expectedRejection: null,
        actualRejection: null,
      });
    }

    for (const [index, command] of scenario.commands.entries()) {
      const expected = asReferenceTransition(reference, command, initial);
      const native = nativeTransitions[index + 1];
      if (native === undefined) {
        throw new Error(`Native core omitted transition ${index}`);
      }
      assertTransition(
        scenario,
        index,
        command,
        "native",
        canonicalDump(reference),
        nativeBefore,
        expected,
        native,
      );
      const actual = wasm.dispatch(command);
      assertTransition(
        scenario,
        index,
        command,
        "wasm",
        canonicalDump(reference),
        wasmBefore,
        expected,
        actual,
      );
      reference = expected.state;
      nativeBefore = native.canonicalDump;
      wasmBefore = actual.canonicalDump;
    }

    return {
      scenario: scenario.name,
      initial: initialDump,
      final: canonicalDump(reference),
      commandCount: scenario.commands.length,
    };
  } finally {
    wasm.destroy();
  }
}
