import { describe, expect, test } from "bun:test";
import { canonicalDump, createGameState, reduce } from "../../src/core";
import { prismLevel, prismWinningTrace } from "../../src/fixtures";
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
});
