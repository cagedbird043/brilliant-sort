import { canonicalDump } from "../core";
import type { GameCommand, GameCorePort, GameEvent, GameState, Rejection } from "../core";
import { diffSnapshots, type SnapshotDifference } from "./diff";

export interface CommandTransition {
  readonly index: number;
  readonly command: GameCommand;
  readonly before: string;
  readonly after: string;
  readonly events: readonly GameEvent[];
  readonly rejection?: Rejection;
  readonly diff: readonly SnapshotDifference[];
}

export interface ReplayResult {
  readonly initial: string;
  readonly finalState: GameState;
  readonly final: string;
  readonly transitions: readonly CommandTransition[];
}

export function applyCommand(
  core: GameCorePort,
  command: GameCommand,
  index = 0,
): CommandTransition {
  const before = canonicalDump(core.snapshot());
  const result = core.dispatch(command);
  const after = result.canonicalDump;

  return {
    index,
    command,
    before,
    after,
    events: result.events,
    rejection: result.rejection ?? undefined,
    diff: diffSnapshots(JSON.parse(before), JSON.parse(after)),
  };
}

export function replayCommandLog(
  core: GameCorePort,
  commands: readonly GameCommand[],
): ReplayResult {
  const initial = canonicalDump(core.snapshot());
  const transitions = commands.map((command, index) => applyCommand(core, command, index));
  const finalState = core.snapshot();

  return {
    initial,
    finalState,
    final: canonicalDump(finalState),
    transitions,
  };
}
