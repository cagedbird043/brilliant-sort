import { canonicalDump, reduce } from "../core";
import type { GameCommand, GameEvent, GameState, Rejection } from "../core";
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
  state: GameState,
  command: GameCommand,
  initialState: GameState,
  index = 0,
): CommandTransition & { readonly nextState: GameState } {
  const before = canonicalDump(state);
  const result = reduce(state, command, initialState);
  const after = canonicalDump(result.nextState);

  return {
    index,
    command,
    before,
    after,
    events: result.events,
    rejection: result.rejection,
    diff: diffSnapshots(JSON.parse(before), JSON.parse(after)),
    nextState: result.nextState,
  };
}

export function replayCommandLog(initialState: GameState, commands: readonly GameCommand[]): ReplayResult {
  let state = initialState;
  const initial = canonicalDump(initialState);
  const transitions: CommandTransition[] = [];

  commands.forEach((command, index) => {
    const transition = applyCommand(state, command, initialState, index);
    transitions.push({
      index: transition.index,
      command: transition.command,
      before: transition.before,
      after: transition.after,
      events: transition.events,
      rejection: transition.rejection,
      diff: transition.diff,
    });
    state = transition.nextState;
  });

  return {
    initial,
    finalState: state,
    final: canonicalDump(state),
    transitions,
  };
}
