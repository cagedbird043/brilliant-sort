import { describe, expect, test } from "bun:test";
import type { Color, LevelCellSpec, LevelSpec } from "../../src/core";
import {
  chromeLevel,
  chromeWinningTrace,
  prismLevel,
  prismWinningTrace,
  tuxLevel,
  tuxWinningTrace,
} from "../../src/fixtures";
import {
  replayDifferential,
  type DifferentialScenario,
} from "../../src/harness/differential";

function cell(
  row: number,
  col: number,
  targetColor: Color,
  id: string,
  color: Color,
): LevelCellSpec {
  return { row, col, targetColor, gem: { id, color } };
}

function level(id: string, rows: number, cols: number, cells: readonly LevelCellSpec[]): LevelSpec {
  return { schemaVersion: 1, id, rows, cols, shelfCapacity: 12, cells };
}

function swapLevel(id: string): LevelSpec {
  return level(id, 1, 2, [
    cell(0, 0, "ice", "a", "navy"),
    cell(0, 1, "navy", "b", "ice"),
  ]);
}

const diagonalLevel = level("diagonal", 3, 3, [
  cell(0, 0, "coral", "a", "ice"),
  cell(1, 1, "coral", "b", "ice"),
  cell(0, 2, "ice", "c", "coral"),
  cell(2, 0, "ice", "d", "coral"),
]);

const lockedLevel = level("locked", 1, 3, [
  cell(0, 0, "ice", "locked", "ice"),
  cell(0, 1, "coral", "navy", "navy"),
  cell(0, 2, "navy", "coral", "coral"),
]);

const fullShelfLevel = level(
  "full-shelf",
  2,
  13,
  Array.from({ length: 13 }, (_, col) => [
    cell(0, col, "coral", `ice-${col}`, "ice"),
    cell(1, col, "ice", `coral-${col}`, "coral"),
  ]).flat(),
);

const articulationExtractionLevel = level("articulation-extraction", 4, 11, [
  ...Array.from({ length: 11 }, (_, col) => cell(0, col, "coral", `n-${col}`, "navy")),
  ...Array.from({ length: 11 }, (_, col) => cell(1, col, "navy", `c-${col}`, "coral")),
  ...Array.from({ length: 3 }, (_, col) => cell(2, col, "jade", `i-${col}`, "ice")),
  ...Array.from({ length: 3 }, (_, col) => cell(3, col, "ice", `j-${col}`, "jade")),
]);

const scenarios: readonly DifferentialScenario[] = [
  {
    name: "fixed-winning-trace",
    level: prismLevel,
    commands: prismWinningTrace,
  },
  {
    name: "diagonal-eight-neighbor-selection",
    level: diagonalLevel,
    commands: [{ type: "select-board-gem", coord: { row: 0, col: 0 } }],
  },
  {
    name: "locked-and-wrong-target-rejections",
    level: lockedLevel,
    commands: [
      { type: "select-board-gem", coord: { row: 0, col: 0 } },
      { type: "select-board-gem", coord: { row: 0, col: 1 } },
      { type: "place-selection-in-shelf" },
      { type: "select-shelf-gem", index: 0 },
      { type: "place-selection-at-target", coord: { row: 0, col: 1 } },
    ],
  },
  {
    name: "full-shelf-rejection",
    level: fullShelfLevel,
    commands: [
      { type: "select-board-gem", coord: { row: 0, col: 0 } },
      { type: "place-selection-in-shelf" },
      { type: "place-selection-in-shelf" },
    ],
  },
  {
    name: "articulation-partial-extraction",
    level: articulationExtractionLevel,
    commands: [
      { type: "select-board-gem", coord: { row: 0, col: 0 } },
      { type: "place-selection-in-shelf" },
      { type: "select-board-gem", coord: { row: 2, col: 1 } },
      { type: "place-selection-in-shelf" },
    ],
  },
  {
    name: "shelf-compaction-win-and-restart",
    level: swapLevel("shelf-compaction"),
    commands: [
      { type: "select-board-gem", coord: { row: 0, col: 0 } },
      { type: "place-selection-in-shelf" },
      { type: "select-board-gem", coord: { row: 0, col: 1 } },
      { type: "place-selection-at-target", coord: { row: 0, col: 0 } },
      { type: "select-shelf-gem", index: 0 },
      { type: "place-selection-at-target", coord: { row: 0, col: 1 } },
      { type: "restart-level" },
    ],
  },
  {
    name: "tux-01-winning-trace",
    level: tuxLevel,
    commands: tuxWinningTrace,
  },
  {
    name: "tux-01-global-wand",
    level: tuxLevel,
    commands: [{ type: "apply-global-wand" }],
  },
  {
    name: "tux-01-mid-game-global-wand",
    level: tuxLevel,
    commands: [
      { type: "select-board-gem", coord: { row: 10, col: 7 } },
      { type: "place-selection-in-shelf" },
      { type: "apply-global-wand" },
    ],
  },
  {
    name: "chrome-01-winning-trace",
    level: chromeLevel,
    commands: chromeWinningTrace,
  },
];

describe("differential core replay", () => {
  test("keeps TypeScript, native C++, and WASM transitions identical", async () => {
    const results = [];
    for (const scenario of scenarios) {
      results.push(await replayDifferential(scenario));
    }

    expect(JSON.parse(results[0]!.final).status).toBe("won");
    const diagonal = JSON.parse(results[1]!.final);
    expect(diagonal.selection.gemIds).toEqual(["a", "b"]);
    const fullShelf = JSON.parse(results[3]!.final);
    expect(fullShelf.shelf.gemIds).toHaveLength(12);
    const articulation = JSON.parse(results[4]!.final);
    expect(articulation.selection.gemIds).toEqual(["i-0", "i-2"]);
    expect(JSON.parse(results[5]!.final).status).toBe("playing");
    const tux = JSON.parse(results[6]!.final);
    expect(tux.status).toBe("won");
    expect(tux.shelf).toEqual({ width: 16, capacity: 16, gemIds: [] });
    const wand = JSON.parse(results[7]!.final);
    expect(wand.status).toBe("won");
    expect(wand.shelf.gemIds).toEqual([]);
    const midGameWand = JSON.parse(results[8]!.final);
    expect(midGameWand.status).toBe("won");
    expect(midGameWand.shelf.gemIds).toEqual([]);
    const chrome = JSON.parse(results[9]!.final);
    expect(results[9]!.commandCount).toBe(chromeWinningTrace.length);
    expect(chrome.status).toBe("won");
    expect(chrome.shelf).toEqual({ width: 16, capacity: 16, gemIds: [] });
    expect(chrome.selection).toBeNull();
    expect(Object.keys(chrome.board.cells)).toHaveLength(562);
  });
});
