import { expect, test } from "bun:test";
import {
  canonicalDump,
  createGameState,
  reduce,
  type CoreTransition,
  type GameCommand,
  type GameState,
} from "../../src/core";
import { audioCueKinds, encodeAudioCue } from "../../src/audio/contracts";
import { deriveAudioCues } from "../../src/audio/game-cues";
import { tuxLevel, tuxWinningTrace } from "../../src/fixtures";

const initial = createGameState(tuxLevel);

function dispatch(state: GameState, command: GameCommand): CoreTransition {
  const result = reduce(state, command, initial);
  return {
    schemaVersion: 1,
    state: result.nextState,
    events: result.events,
    rejection: result.rejection ?? null,
    canonicalDump: canonicalDump(result.nextState),
  };
}

test("post-dispatch facts derive stable selection, Shelf, progress, and rejection cues", () => {
  const selected = dispatch(initial, tuxWinningTrace[0]!);
  const selectionAudio = deriveAudioCues(selected, tuxWinningTrace[0]!, 10);
  expect(selectionAudio).toEqual({
    cues: [{ kind: "selection", color: "obsidian", count: 58, sequence: 10 }],
    nextSequence: 11,
  });

  const stored = dispatch(selected.state, tuxWinningTrace[1]!);
  const storeAudio = deriveAudioCues(stored, tuxWinningTrace[1]!, selectionAudio.nextSequence);
  expect(storeAudio).toEqual({
    cues: [
      { kind: "shelf_store", color: "obsidian", count: 16, sequence: 11 },
      { kind: "progress", matched: 410, total: 546, sequence: 12 },
    ],
    nextSequence: 13,
  });

  const navySelected = dispatch(stored.state, {
    type: "select-board-gem",
    coord: { row: 16, col: 7 },
  });
  const rejectedCommand = {
    type: "place-selection-at-target",
    coord: { row: 10, col: 7 },
  } as const;
  const rejected = dispatch(navySelected.state, rejectedCommand);
  expect(deriveAudioCues(rejected, rejectedCommand, 13)).toEqual({
    cues: [{ kind: "rejected", code: 5, sequence: 13 }],
    nextSequence: 14,
  });
});

test("the global wand emits one victory cue without per-gem audio flooding", () => {
  const command = { type: "apply-global-wand" } as const;
  const transition = dispatch(initial, command);

  expect(deriveAudioCues(transition, command, 41)).toEqual({
    cues: [{ kind: "won", sequence: 41 }],
    nextSequence: 42,
  });
});

test("replay resets the audio transport before a second victory cue", () => {
  const winCommand = { type: "apply-global-wand" } as const;
  const firstWin = dispatch(initial, winCommand);
  const restartCommand = { type: "restart-level" } as const;
  const restarted = dispatch(firstWin.state, restartCommand);

  expect(deriveAudioCues(restarted, restartCommand, 42)).toEqual({
    cues: [{ kind: "restart", sequence: 42 }],
    nextSequence: 43,
  });
  expect(audioCueKinds.restart).toBe(7);
  expect(encodeAudioCue({ kind: "restart", sequence: 42 })[4]).toBe(7);

  const secondWin = dispatch(restarted.state, winCommand);
  expect(deriveAudioCues(secondWin, winCommand, 43)).toEqual({
    cues: [{ kind: "won", sequence: 43 }],
    nextSequence: 44,
  });
});

test("the full Tux trace emits every successful cue in strict sequence with victory last", () => {
  let state = initial;
  let sequence = 0;
  const kinds: string[] = [];

  for (const command of tuxWinningTrace) {
    const transition = dispatch(state, command);
    const audio = deriveAudioCues(transition, command, sequence);
    kinds.push(...audio.cues.map((cue) => cue.kind));
    sequence = audio.nextSequence;
    state = transition.state;
  }

  const counts = Object.fromEntries(
    [...new Set(kinds)].map((kind) => [kind, kinds.filter((value) => value === kind).length]),
  );
  expect(counts).toEqual({
    selection: 24,
    shelf_store: 4,
    progress: 24,
    target_place: 20,
    shelf_compact: 9,
    won: 1,
  });
  expect(sequence).toBe(82);
  expect(kinds.at(-1)).toBe("won");
  expect(state.status).toBe("won");
});
