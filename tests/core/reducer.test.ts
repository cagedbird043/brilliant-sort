import { describe, expect, test } from "bun:test";
import { keyOf } from "../../src/core/coords";
import { canonicalDump } from "../../src/core/dump";
import { createGameState } from "../../src/core/level";
import { reduce } from "../../src/core/reducer";
import { isSelectionConnected } from "../../src/core/selectors";
import type { BoardCell, Color, GameCommand, GameState, Gem } from "../../src/core/types";
import { prismLevel } from "../../src/fixtures";

interface TestCell {
  readonly row: number;
  readonly col: number;
  readonly targetColor: Color;
  readonly gem?: Gem;
}

interface TestStateOptions {
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly TestCell[];
  readonly shelfGems?: readonly Gem[];
  readonly shelfCapacity?: number;
}

function makeState({
  rows,
  cols,
  cells,
  shelfGems = [],
  shelfCapacity = 12,
}: TestStateOptions): GameState {
  const boardCells: Record<string, BoardCell> = {};
  const gems: Record<string, Gem> = {};

  for (const cell of cells) {
    boardCells[keyOf(cell)] = {
      targetColor: cell.targetColor,
      gemId: cell.gem?.id ?? null,
    };
    if (cell.gem !== undefined) {
      gems[cell.gem.id] = cell.gem;
    }
  }
  for (const gem of shelfGems) {
    gems[gem.id] = gem;
  }

  return {
    schemaVersion: 1,
    levelId: "test",
    board: { rows, cols, cells: boardCells },
    gems,
    shelf: {
      width: 12,
      capacity: shelfCapacity,
      gemIds: shelfGems.map((gem) => gem.id),
    },
    selection: null,
    status: "playing",
  };
}

function replay(initialState: GameState, commands: readonly GameCommand[]): GameState {
  let state = initialState;

  for (const command of commands) {
    const transition = reduce(state, command, initialState);
    expect(transition.rejection).toBeUndefined();
    state = transition.nextState;
  }

  return state;
}

describe("movable components", () => {
  test("connects diagonal movable gems while locked and color barriers stop traversal", () => {
    const initial = makeState({
      rows: 4,
      cols: 4,
      cells: [
        { row: 0, col: 0, targetColor: "navy", gem: { id: "a", color: "ice" } },
        { row: 1, col: 1, targetColor: "navy", gem: { id: "b", color: "ice" } },
        { row: 2, col: 2, targetColor: "ice", gem: { id: "locked", color: "ice" } },
        { row: 3, col: 3, targetColor: "navy", gem: { id: "far", color: "ice" } },
        { row: 0, col: 2, targetColor: "navy", gem: { id: "barrier", color: "coral" } },
        { row: 0, col: 3, targetColor: "navy", gem: { id: "other-side", color: "ice" } },
      ],
    });

    const selected = reduce(initial, { type: "select-board-gem", coord: { row: 0, col: 0 } }, initial);
    expect(selected.rejection).toBeUndefined();
    expect(selected.nextState.selection).toEqual({
      container: "board",
      anchor: { row: 0, col: 0 },
      color: "ice",
      gemIds: ["a", "b"],
    });

    const locked = reduce(initial, { type: "select-board-gem", coord: { row: 2, col: 2 } }, initial);
    expect(locked.rejection?.code).toBe("locked-gem");
    expect(canonicalDump(locked.nextState)).toBe(canonicalDump(initial));

    const invalid = reduce(initial, { type: "select-board-gem", coord: { row: 1, col: 3 } }, initial);
    expect(invalid.rejection?.code).toBe("no-selectable-gem");
  });
});

describe("safe extraction and Shelf movement", () => {
  test("uses deterministic boundary priority and keeps a partial Board selection connected", () => {
    const initial = makeState({
      rows: 1,
      cols: 3,
      cells: [
        { row: 0, col: 0, targetColor: "coral", gem: { id: "A", color: "ice" } },
        { row: 0, col: 1, targetColor: "coral", gem: { id: "B", color: "ice" } },
        { row: 0, col: 2, targetColor: "coral", gem: { id: "C", color: "ice" } },
      ],
      shelfGems: Array.from({ length: 11 }, (_, index) => ({
        id: `stored-${index}`,
        color: "navy" as const,
      })),
    });
    const selected = reduce(initial, { type: "select-board-gem", coord: { row: 0, col: 1 } }, initial);
    const moved = reduce(selected.nextState, { type: "place-selection-in-shelf" }, initial);

    expect(moved.rejection).toBeUndefined();
    expect(moved.nextState.shelf.gemIds.at(-1)).toBe("A");
    expect(moved.nextState.selection?.gemIds).toEqual(["B", "C"]);
    expect(moved.nextState.selection).not.toBeNull();
    expect(isSelectionConnected(moved.nextState, moved.nextState.selection!)).toBe(true);
  });

  test("compacts every later Shelf gem after a Shelf-origin placement", () => {
    const initial = makeState({
      rows: 1,
      cols: 1,
      cells: [{ row: 0, col: 0, targetColor: "ice" }],
      shelfGems: [
        { id: "A", color: "navy" },
        { id: "B", color: "ice" },
        { id: "C", color: "coral" },
        { id: "D", color: "jade" },
        { id: "E", color: "navy" },
        { id: "F", color: "coral" },
        { id: "G", color: "jade" },
        { id: "H", color: "navy" },
      ],
    });
    const selected = reduce(initial, { type: "select-shelf-gem", index: 1 }, initial);
    const placed = reduce(
      selected.nextState,
      { type: "place-selection-at-target", coord: { row: 0, col: 0 } },
      initial,
    );

    expect(placed.rejection).toBeUndefined();
    expect(placed.nextState.board.cells["0:0"]?.gemId).toBe("B");
    expect(placed.nextState.shelf.gemIds).toEqual(["A", "C", "D", "E", "F", "G", "H"]);
    expect(placed.events.map((event) => event.type)).toEqual(["gem-placed", "shelf-compacted"]);
  });
});

describe("selection and target rejection", () => {
  test("replaces and cancels selections without moving their gems, and restarts from the supplied state", () => {
    const initial = makeState({
      rows: 3,
      cols: 3,
      cells: [
        { row: 0, col: 0, targetColor: "coral", gem: { id: "first", color: "ice" } },
        { row: 2, col: 2, targetColor: "coral", gem: { id: "second", color: "navy" } },
      ],
    });
    const first = reduce(initial, { type: "select-board-gem", coord: { row: 0, col: 0 } }, initial);
    const replaced = reduce(first.nextState, { type: "select-board-gem", coord: { row: 2, col: 2 } }, initial);

    expect(replaced.nextState.selection?.gemIds).toEqual(["second"]);
    expect(replaced.nextState.board.cells["0:0"]?.gemId).toBe("first");
    expect(replaced.nextState.board.cells["2:2"]?.gemId).toBe("second");

    const cancelled = reduce(replaced.nextState, { type: "cancel-selection" }, initial);
    expect(cancelled.rejection).toBeUndefined();
    expect(cancelled.nextState.selection).toBeNull();
    expect(cancelled.nextState.board.cells["2:2"]?.gemId).toBe("second");

    const restarted = reduce(replaced.nextState, { type: "restart-level" }, initial);
    expect(canonicalDump(restarted.nextState)).toBe(canonicalDump(initial));
    expect(restarted.nextState).not.toBe(initial);
  });

  test("rejects invalid, occupied, and wrong-color targets without dropping selection", () => {
    const initial = makeState({
      rows: 2,
      cols: 2,
      cells: [
        { row: 0, col: 0, targetColor: "coral", gem: { id: "source", color: "ice" } },
        { row: 0, col: 1, targetColor: "ice", gem: { id: "occupied", color: "navy" } },
        { row: 1, col: 0, targetColor: "coral" },
      ],
    });
    const selected = reduce(initial, { type: "select-board-gem", coord: { row: 0, col: 0 } }, initial).nextState;

    const attempts = [
      { coord: { row: 1, col: 1 }, code: "invalid-target" },
      { coord: { row: 0, col: 1 }, code: "target-is-occupied" },
      { coord: { row: 1, col: 0 }, code: "target-color-mismatch" },
    ] as const;

    for (const attempt of attempts) {
      const rejected = reduce(selected, { type: "place-selection-at-target", coord: attempt.coord }, initial);
      expect(rejected.rejection?.code).toBe(attempt.code);
      expect(canonicalDump(rejected.nextState)).toBe(canonicalDump(selected));
      expect(rejected.nextState.selection).toEqual(selected.selection);
    }
  });
});

describe("prism fixture replay", () => {
  test("marks an already-solved fixed level Won", () => {
    const solved = createGameState({
      schemaVersion: 1,
      id: "already-solved",
      rows: 1,
      cols: 1,
      shelfCapacity: 12,
      cells: [
        {
          row: 0,
          col: 0,
          targetColor: "ice",
          gem: { id: "solved-gem", color: "ice" },
        },
      ],
    });

    expect(solved.status).toBe("won");
  });

  test("reaches Won through a deterministic full trace", () => {
    const initial = createGameState(prismLevel);
    const trace: readonly GameCommand[] = [
      { type: "select-board-gem", coord: { row: 0, col: 0 } },
      { type: "place-selection-in-shelf" },
      { type: "select-board-gem", coord: { row: 3, col: 3 } },
      { type: "place-selection-at-target", coord: { row: 0, col: 0 } },
      { type: "select-board-gem", coord: { row: 3, col: 0 } },
      { type: "place-selection-at-target", coord: { row: 3, col: 3 } },
      { type: "select-board-gem", coord: { row: 0, col: 3 } },
      { type: "place-selection-at-target", coord: { row: 3, col: 0 } },
      { type: "select-shelf-gem", index: 0 },
      { type: "place-selection-at-target", coord: { row: 0, col: 3 } },
    ];

    const finalState = replay(initial, trace);
    const replayedState = replay(createGameState(prismLevel), trace);

    expect(finalState.status).toBe("won");
    expect(finalState.selection).toBeNull();
    expect(finalState.shelf.gemIds).toEqual([]);
    expect(canonicalDump(finalState)).toBe(canonicalDump(replayedState));
    expect(
      Object.values(finalState.board.cells).every((cell) => {
        const gemId = cell.gemId;
        return gemId !== null && finalState.gems[gemId]?.color === cell.targetColor;
      }),
    ).toBe(true);
  });
});
