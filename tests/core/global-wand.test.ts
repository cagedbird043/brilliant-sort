import { expect, test } from "bun:test";
import { canonicalDump, createGameState, reduce, type GameState } from "../../src/core";
import { tuxLevel } from "../../src/fixtures";

function expectSolved(state: GameState): void {
  expect(state.status).toBe("won");
  expect(state.selection).toBeNull();
  expect(state.shelf.gemIds).toEqual([]);
  const boardGemIds = Object.values(state.board.cells).map((cell) => cell.gemId);
  expect(boardGemIds.every((gemId) => gemId !== null)).toBe(true);
  expect(new Set(boardGemIds)).toHaveLength(Object.keys(state.gems).length);
  for (const cell of Object.values(state.board.cells)) {
    expect(state.gems[cell.gemId!]!.color).toBe(cell.targetColor);
  }
}

test("the global wand preserves locked Tux Gems and solves deterministically", () => {
  const initial = createGameState(tuxLevel);
  const lockedBefore = Object.fromEntries(
    Object.entries(initial.board.cells)
      .filter(([, cell]) => cell.gemId !== null && initial.gems[cell.gemId]!.color === cell.targetColor)
      .map(([cellKey, cell]) => [cellKey, cell.gemId]),
  );

  const first = reduce(initial, { type: "apply-global-wand" }, initial);
  const second = reduce(initial, { type: "apply-global-wand" }, initial);

  expect(first.rejection).toBeUndefined();
  expect(first.events).toEqual([
    { type: "global-wand-applied", detail: "136" },
    { type: "won" },
  ]);
  expect(Object.keys(lockedBefore)).toHaveLength(410);
  for (const [cellKey, gemId] of Object.entries(lockedBefore)) {
    expect(first.nextState.board.cells[cellKey]!.gemId).toBe(gemId);
  }
  expect(canonicalDump(first.nextState)).toBe(canonicalDump(second.nextState));
  expectSolved(first.nextState);

  const rejected = reduce(first.nextState, { type: "apply-global-wand" }, initial);
  expect(rejected.rejection?.code).toBe("game-won");
  expect(rejected.events).toEqual([]);
  expect(rejected.nextState).toBe(first.nextState);
});

test("the global wand returns every Shelf Gem from a mid-game state", () => {
  const initial = createGameState(tuxLevel);
  const selected = reduce(
    initial,
    { type: "select-board-gem", coord: { row: 10, col: 7 } },
    initial,
  );
  const stored = reduce(selected.nextState, { type: "place-selection-in-shelf" }, initial);
  expect(stored.nextState.shelf.gemIds).toHaveLength(16);
  expect(stored.nextState.selection?.gemIds).toHaveLength(42);

  const solved = reduce(stored.nextState, { type: "apply-global-wand" }, initial);
  expect(solved.events).toEqual([
    { type: "global-wand-applied", detail: "136" },
    { type: "won" },
  ]);
  expect(solved.nextState.shelf).toEqual({ width: 16, capacity: 16, gemIds: [] });
  expectSolved(solved.nextState);
});
