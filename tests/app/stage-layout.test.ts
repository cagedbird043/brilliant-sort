import { expect, test } from "bun:test";
import { calculateStageLayout } from "../../src/app/stage-layout";

const tuxBoard = { rows: 32, cols: 24, shelfCapacity: 16 } as const;
const chromeBoard = { rows: 32, cols: 32, shelfCapacity: 16 } as const;


test("the stage solver selects stable integer layouts for desktop, square, and portrait", () => {
  expect(calculateStageLayout({ width: 1280, height: 720, ...tuxBoard })).toEqual({
    orientation: "side",
    boardCellSize: 21,
    bankCellSize: 72,
    bankSplitIndex: 8,
    directTouch: false,
    maxZoom: 2,
  });
  expect(calculateStageLayout({ width: 768, height: 768, ...tuxBoard })).toEqual({
    orientation: "side",
    boardCellSize: 22,
    bankCellSize: 72,
    bankSplitIndex: 8,
    directTouch: false,
    maxZoom: 2,
  });
  expect(calculateStageLayout({ width: 390, height: 844, ...tuxBoard })).toEqual({
    orientation: "stacked",
    boardCellSize: 14,
    bankCellSize: 43,
    bankSplitIndex: 8,
    directTouch: false,
    maxZoom: 2,
  });
  expect(calculateStageLayout({ width: 320, height: 568, ...tuxBoard })).toEqual({
    orientation: "stacked",
    boardCellSize: 11,
    bankCellSize: 35,
    bankSplitIndex: 8,
    directTouch: false,
    maxZoom: 3,
  });
});

test("the stage solver keeps Chrome bounded at representative desktop and mobile dimensions", () => {
  expect(calculateStageLayout({ width: 1280, height: 720, ...chromeBoard })).toEqual({
    orientation: "side",
    boardCellSize: 21,
    bankCellSize: 72,
    bankSplitIndex: 8,
    directTouch: false,
    maxZoom: 2,
  });
  expect(calculateStageLayout({ width: 390, height: 844, ...chromeBoard })).toEqual({
    orientation: "stacked",
    boardCellSize: 10,
    bankCellSize: 43,
    bankSplitIndex: 8,
    directTouch: false,
    maxZoom: 3,
  });
});

test("the stage solver rejects invalid geometry and splits odd Shelf capacities deterministically", () => {
  expect(() => calculateStageLayout({ width: 0, height: 720, ...tuxBoard })).toThrow(
    "must be positive",
  );
  expect(
    calculateStageLayout({ width: 390, height: 844, rows: 32, cols: 24, shelfCapacity: 15 })
      .bankSplitIndex,
  ).toBe(8);
});
