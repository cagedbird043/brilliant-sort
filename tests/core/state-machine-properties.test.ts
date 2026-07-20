import { expect, test } from "bun:test";
import { coordFromKey } from "../../src/core/coords";
import {
  canonicalDump,
  createGameState,
  reduce,
  type Color,
  type GameCommand,
  type GameState,
  type LevelSpec,
} from "../../src/core";

const PROPERTY_COLORS = ["ice", "navy", "coral", "jade"] as const satisfies readonly Color[];
const propertyLevel: LevelSpec = {
  schemaVersion: 1,
  id: "state-machine-properties",
  rows: PROPERTY_COLORS.length,
  cols: 4,
  shelfCapacity: 3,
  cells: Array.from({ length: PROPERTY_COLORS.length * 4 }, (_, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    return {
      row,
      col,
      targetColor: PROPERTY_COLORS[row]!,
      gem: {
        id: `gem-${index}`,
        color: PROPERTY_COLORS[(row + 1) % PROPERTY_COLORS.length]!,
      },
    };
  }),
};

function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function randomCoord(state: GameState, next: () => number): { readonly row: number; readonly col: number } {
  return {
    row: (next() % (state.board.rows + 2)) - 1,
    col: (next() % (state.board.cols + 2)) - 1,
  };
}

function chooseCommand(state: GameState, next: () => number): GameCommand {
  const roll = next() % 100;
  if (roll < 25) {
    const keys = Object.keys(state.board.cells);
    const coord = next() % 4 === 0 ? randomCoord(state, next) : coordFromKey(keys[next() % keys.length]!);
    return { type: "select-board-gem", coord };
  }
  if (roll < 40) {
    const index =
      state.shelf.gemIds.length > 0 && next() % 4 !== 0
        ? next() % state.shelf.gemIds.length
        : (next() % (state.shelf.capacity + 2)) - 1;
    return { type: "select-shelf-gem", index };
  }
  if (roll < 50) {
    return { type: "cancel-selection" };
  }
  if (roll < 65) {
    return { type: "place-selection-in-shelf" };
  }
  if (roll < 88) {
    const matchingTargets = Object.entries(state.board.cells)
      .filter(([, cell]) => cell.gemId === null && cell.targetColor === state.selection?.color)
      .map(([key]) => coordFromKey(key));
    const coord =
      matchingTargets.length > 0 && next() % 4 !== 0
        ? matchingTargets[next() % matchingTargets.length]!
        : randomCoord(state, next);
    return { type: "place-selection-at-target", coord };
  }
  if (roll < 93) {
    return { type: "apply-global-wand" };
  }
  return { type: "restart-level" };
}

function expectStateInvariants(state: GameState, initial: GameState): void {
  const boardGemIds = Object.values(state.board.cells).flatMap((cell) =>
    cell.gemId === null ? [] : [cell.gemId],
  );
  const locatedGemIds = [...boardGemIds, ...state.shelf.gemIds];
  const expectedGemIds = Object.keys(initial.gems).sort();

  expect(locatedGemIds).toHaveLength(expectedGemIds.length);
  expect(new Set(locatedGemIds).size).toBe(locatedGemIds.length);
  expect([...locatedGemIds].sort()).toEqual(expectedGemIds);
  expect(state.shelf.gemIds.length).toBeLessThanOrEqual(state.shelf.capacity);
  expect(state.gems).toEqual(initial.gems);
  expect(Object.keys(state.board.cells).sort()).toEqual(Object.keys(initial.board.cells).sort());
  for (const [key, cell] of Object.entries(state.board.cells)) {
    expect(cell.targetColor).toBe(initial.board.cells[key]!.targetColor);
  }

  if (state.selection !== null) {
    expect(state.selection.gemIds.length).toBeGreaterThan(0);
    expect(new Set(state.selection.gemIds).size).toBe(state.selection.gemIds.length);
    const containerGemIds = new Set(
      state.selection.container === "board" ? boardGemIds : state.shelf.gemIds,
    );
    for (const gemId of state.selection.gemIds) {
      expect(containerGemIds.has(gemId)).toBe(true);
      expect(state.gems[gemId]!.color).toBe(state.selection.color);
    }
  }

  const solved =
    state.shelf.gemIds.length === 0 &&
    Object.values(state.board.cells).every(
      (cell) => cell.gemId !== null && state.gems[cell.gemId]!.color === cell.targetColor,
    );
  expect(state.status).toBe(solved ? "won" : "playing");
  if (solved) {
    expect(state.selection).toBeNull();
  }
}

for (let seed = 1; seed <= 32; seed += 1) {
  test(`seeded reducer properties preserve state invariants for seed ${seed}`, () => {
    const next = randomSource(seed);
    const initial = createGameState(propertyLevel);
    let state = initial;

    for (let step = 0; step < 128; step += 1) {
      const command = chooseCommand(state, next);
      const before = canonicalDump(state);
      const first = reduce(state, command, initial);
      const second = reduce(state, command, initial);

      expect(canonicalDump(state)).toBe(before);
      expect(canonicalDump(first.nextState)).toBe(canonicalDump(second.nextState));
      expect(first.events).toEqual(second.events);
      expect(first.rejection).toEqual(second.rejection);
      if (first.rejection !== undefined) {
        expect(canonicalDump(first.nextState)).toBe(before);
      }
      expectStateInvariants(first.nextState, initial);
      state = first.nextState;
    }
  });
}
