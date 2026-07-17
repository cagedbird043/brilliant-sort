import { describe, expect, test } from "bun:test";
import { canonicalDump, createGameState, reduce } from "../../src/core";
import {
  chromeLevel,
  chromeWinningTrace,
  prismLevel,
  prismWinningTrace,
  tuxLevel,
  tuxWinningTrace,
} from "../../src/fixtures";
import { GameCoreFactory } from "../../src/wasm/game-core";

describe("WasmGameCore", () => {
  test("matches every transition of the fixed winning trace", async () => {
    const core = await GameCoreFactory.load(prismLevel);
    try {
      let reference = createGameState(prismLevel);
      expect(canonicalDump(core.snapshot())).toBe(canonicalDump(reference));

      for (const command of prismWinningTrace) {
        const expected = reduce(reference, command, createGameState(prismLevel));
        const actual = core.dispatch(command);
        expect(actual.canonicalDump).toBe(canonicalDump(expected.nextState));
        expect(actual.events).toEqual(expected.events);
        expect(actual.rejection ?? undefined).toEqual(expected.rejection);
        reference = expected.nextState;
      }

      expect(core.snapshot().status).toBe("won");

    } finally {
      core.destroy();
    }
  });

  test("matches every transition of the Tux winning trace", async () => {
    const core = await GameCoreFactory.load(tuxLevel);
    try {
      let reference = createGameState(tuxLevel);
      const initial = createGameState(tuxLevel);
      expect(canonicalDump(core.snapshot())).toBe(canonicalDump(reference));

      for (const command of tuxWinningTrace) {
        const expected = reduce(reference, command, initial);
        const actual = core.dispatch(command);
        expect(actual.canonicalDump).toBe(canonicalDump(expected.nextState));
        expect(actual.events).toEqual(expected.events);
        expect(actual.rejection ?? undefined).toEqual(expected.rejection);
        reference = expected.nextState;
      }

      expect(core.snapshot().status).toBe("won");
      expect(core.snapshot().shelf).toEqual({ width: 16, capacity: 16, gemIds: [] });
    } finally {
      core.destroy();
    }
  });
  test("matches every transition of the Chrome winning trace", async () => {
    const core = await GameCoreFactory.load(chromeLevel);
    try {
      const initial = createGameState(chromeLevel);
      let reference = initial;
      expect(canonicalDump(core.snapshot())).toBe(canonicalDump(reference));

      for (const command of chromeWinningTrace) {
        const expected = reduce(reference, command, initial);
        const actual = core.dispatch(command);
        expect(actual.canonicalDump).toBe(canonicalDump(expected.nextState));
        expect(actual.events).toEqual(expected.events);
        expect(actual.rejection ?? undefined).toEqual(expected.rejection);
        reference = expected.nextState;
      }

      const finalState = core.snapshot();
      expect(finalState.status).toBe("won");
      expect(finalState.shelf).toEqual({ width: 16, capacity: 16, gemIds: [] });
      expect(Object.keys(finalState.board.cells)).toHaveLength(562);
      expect(finalState.selection).toBeNull();
    } finally {
      core.destroy();
    }
  });

});
