import { expect, test } from "bun:test";
import { canonicalDump } from "../../src/core";
import {
  chromeLevel,
  chromeWinningTrace,
  prismLevel,
  prismWinningTrace,
  tuxLevel,
  tuxWinningTrace,
} from "../../src/fixtures";
import { diffSnapshots, replayCommandLog } from "../../src/harness";
import { GameCoreFactory } from "../../src/wasm/game-core";

test("the committed prism trace reaches victory through the WASM core", async () => {
  const core = await GameCoreFactory.load(prismLevel);
  try {
    const replay = replayCommandLog(core, prismWinningTrace);

    expect(replay.transitions).toHaveLength(prismWinningTrace.length);
    expect(replay.transitions.every((transition) => transition.rejection === undefined)).toBe(true);
    expect(replay.finalState.status).toBe("won");
    expect(replay.finalState.shelf.gemIds).toHaveLength(0);
    expect(replay.finalState.selection).toBeNull();
  } finally {
    core.destroy();
  }
});

test("the committed Tux trace reaches victory through the WASM core", async () => {
  const core = await GameCoreFactory.load(tuxLevel);
  try {
    const replay = replayCommandLog(core, tuxWinningTrace);

    expect(replay.transitions).toHaveLength(48);
    expect(replay.transitions.every((transition) => transition.rejection === undefined)).toBe(true);
    expect(replay.finalState.status).toBe("won");
    expect(replay.finalState.shelf).toEqual({ width: 16, capacity: 16, gemIds: [] });
    expect(Object.keys(replay.finalState.board.cells)).toHaveLength(546);
    expect(replay.finalState.selection).toBeNull();
  } finally {
    core.destroy();
  }
});

test("the committed Chrome select/Shelf/wand trace reaches victory through the WASM core", async () => {
  expect(chromeWinningTrace.map((command) => command.type)).toEqual([
    "select-board-gem",
    "place-selection-in-shelf",
    "apply-global-wand",
  ]);

  const core = await GameCoreFactory.load(chromeLevel);
  try {
    const replay = replayCommandLog(core, chromeWinningTrace);

    expect(replay.transitions).toHaveLength(chromeWinningTrace.length);
    expect(replay.transitions.every((transition) => transition.rejection === undefined)).toBe(true);
    expect(replay.finalState.status).toBe("won");
    expect(replay.finalState.shelf).toEqual({ width: 16, capacity: 16, gemIds: [] });
    expect(Object.keys(replay.finalState.board.cells)).toHaveLength(562);
    expect(replay.finalState.selection).toBeNull();
  } finally {
    core.destroy();
  }
});

test("independent WASM sessions produce byte-equivalent trace dumps", async () => {
  const [first, second] = await Promise.all([
    GameCoreFactory.load(prismLevel),
    GameCoreFactory.load(prismLevel),
  ]);
  try {
    const firstReplay = replayCommandLog(first, prismWinningTrace);
    const secondReplay = replayCommandLog(second, prismWinningTrace);

    expect(firstReplay.final).toBe(secondReplay.final);
    expect(canonicalDump(firstReplay.finalState)).toBe(canonicalDump(secondReplay.finalState));
  } finally {
    first.destroy();
    second.destroy();
  }
});

test("a rejected wrong-color target leaves WASM state unchanged", async () => {
  const core = await GameCoreFactory.load(prismLevel);
  try {
    core.dispatch({ type: "select-board-gem", coord: { row: 0, col: 0 } });
    core.dispatch({ type: "place-selection-in-shelf" });
    core.dispatch({ type: "select-board-gem", coord: { row: 3, col: 0 } });
    const before = canonicalDump(core.snapshot());
    const result = core.dispatch({
      type: "place-selection-at-target",
      coord: { row: 0, col: 0 },
    });
    const after = canonicalDump(core.snapshot());

    expect(result.rejection?.code).toBe("target-color-mismatch");
    expect(after).toBe(before);
    expect(diffSnapshots(JSON.parse(before), JSON.parse(after))).toEqual([]);
  } finally {
    core.destroy();
  }
});
