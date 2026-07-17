import { expect, test } from "bun:test";
import type { GameState } from "../src/core";
import type { DioramaTarget } from "../src/three/contracts";
import { targetToCommand } from "../src/three/interaction";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    schemaVersion: 1,
    levelId: "interaction-test",
    board: {
      rows: 2,
      cols: 2,
      cells: {
        "0:0": { targetColor: "ice", gemId: "board-gem" },
        "0:1": { targetColor: "coral", gemId: "locked-gem" },
        "1:0": { targetColor: "jade", gemId: null },
      },
    },
    gems: {
      "board-gem": { id: "board-gem", color: "coral" },
      "locked-gem": { id: "locked-gem", color: "coral" },
      "shelf-gem": { id: "shelf-gem", color: "jade" },
    },
    shelf: {
      width: 3,
      capacity: 3,
      gemIds: ["shelf-gem"],
    },
    selection: null,
    status: "playing",
    ...overrides,
  };
}

const boardGem: DioramaTarget = { kind: "gem", gemId: "board-gem" };
const lockedGem: DioramaTarget = { kind: "gem", gemId: "locked-gem" };
const shelfGem: DioramaTarget = { kind: "gem", gemId: "shelf-gem" };
const emptyTarget: DioramaTarget = { kind: "board", coord: { row: 1, col: 0 } };
const emptyShelf: DioramaTarget = { kind: "shelf", index: 2 };

test("maps an occupied Board gem to its board coordinate", () => {
  expect(targetToCommand(boardGem, makeState())).toEqual({
    type: "select-board-gem",
    coord: { row: 0, col: 0 },
  });
});

test("maps an empty target to placement when a Board selection exists", () => {
  expect(
    targetToCommand(
      emptyTarget,
      makeState({
        selection: {
          container: "board",
          anchor: { row: 0, col: 0 },
          color: "coral",
          gemIds: ["board-gem"],
        },
      }),
    ),
  ).toEqual({ type: "place-selection-at-target", coord: { row: 1, col: 0 } });
});

test("maps a Shelf gem to its compact Shelf index", () => {
  expect(targetToCommand(shelfGem, makeState())).toEqual({
    type: "select-shelf-gem",
    index: 0,
  });
});

test("maps an empty Shelf slot to storage for a Board selection", () => {
  expect(
    targetToCommand(
      emptyShelf,
      makeState({
        selection: {
          container: "board",
          anchor: { row: 0, col: 0 },
          color: "coral",
          gemIds: ["board-gem"],
        },
      }),
    ),
  ).toEqual({ type: "place-selection-in-shelf" });
});

test("keeps locked gems on the core rejection path", () => {
  expect(targetToCommand(lockedGem, makeState())).toEqual({
    type: "select-board-gem",
    coord: { row: 0, col: 1 },
  });
});

test("returns no command for a won state or an empty Shelf without selection", () => {
  expect(targetToCommand(boardGem, makeState({ status: "won" }))).toBeNull();
  expect(targetToCommand(emptyShelf, makeState())).toBeNull();
});

test("maps a Shelf selection on an empty target to the existing placement command", () => {
  expect(
    targetToCommand(
      emptyTarget,
      makeState({
        selection: {
          container: "shelf",
          anchor: { row: 0, col: 0 },
          color: "jade",
          gemIds: ["shelf-gem"],
        },
      }),
    ),
  ).toEqual({ type: "place-selection-at-target", coord: { row: 1, col: 0 } });
});
