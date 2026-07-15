import { expect, test } from "bun:test";
import { canonicalDump, reduce } from "../../src/core";
import type { GameCommand, GameState } from "../../src/core";
import { diffSnapshots, loadScenario, replayCommandLog } from "../../src/harness";
import prismWinningTraceJson from "../../src/fixtures/traces/prism-01.win.json";

const prismWinningTrace = prismWinningTraceJson as unknown as readonly GameCommand[];

function advanceToWrongTargetAttempt(initialState: GameState): GameState {
  let state = reduce(initialState, { type: "select-board-gem", coord: { row: 0, col: 0 } }, initialState).nextState;
  state = reduce(state, { type: "place-selection-in-shelf" }, initialState).nextState;
  return reduce(state, { type: "select-board-gem", coord: { row: 3, col: 0 } }, initialState).nextState;
}

test("the committed prism trace reaches victory without rejection", () => {
  const { initialState } = loadScenario("prism-01");
  const replay = replayCommandLog(initialState, prismWinningTrace);

  expect(replay.transitions).toHaveLength(prismWinningTrace.length);
  expect(replay.transitions.every((transition) => transition.rejection === undefined)).toBe(true);
  expect(replay.finalState.status).toBe("won");
  expect(replay.finalState.shelf.gemIds).toHaveLength(0);
  expect(replay.finalState.selection).toBeNull();
});

test("identical fixture and command trace produce byte-equivalent dumps", () => {
  const first = loadScenario("prism-01").initialState;
  const second = loadScenario("prism-01").initialState;

  const firstReplay = replayCommandLog(first, prismWinningTrace);
  const secondReplay = replayCommandLog(second, prismWinningTrace);

  expect(firstReplay.final).toBe(secondReplay.final);
  expect(canonicalDump(firstReplay.finalState)).toBe(canonicalDump(secondReplay.finalState));
});

test("a rejected wrong-color target leaves semantic state unchanged", () => {
  const { initialState } = loadScenario("prism-01");
  const state = advanceToWrongTargetAttempt(initialState);
  const before = canonicalDump(state);
  const result = reduce(
    state,
    { type: "place-selection-at-target", coord: { row: 0, col: 0 } },
    initialState,
  );
  const after = canonicalDump(result.nextState);

  expect(result.rejection?.code).toBe("target-color-mismatch");
  expect(after).toBe(before);
  expect(diffSnapshots(JSON.parse(before), JSON.parse(after))).toEqual([]);
});
