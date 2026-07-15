import { keyOf } from "./coords";
import { isWon } from "./selectors";
import type { BoardCell, GameState, Gem, LevelSpec } from "./types";

export class LevelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelValidationError";
  }
}

export function createGameState(spec: LevelSpec): GameState {
  validateLevelSpec(spec);

  const cells: Record<string, BoardCell> = {};
  const gems: Record<string, Gem> = {};

  for (const cell of spec.cells) {
    const key = keyOf(cell);
    cells[key] = {
      targetColor: cell.targetColor,
      gemId: cell.gem.id,
    };
    gems[cell.gem.id] = cell.gem;
  }

  const state: GameState = {
    schemaVersion: 1,
    levelId: spec.id,
    board: {
      rows: spec.rows,
      cols: spec.cols,
      cells,
    },
    gems,
    shelf: {
      width: 12,
      capacity: spec.shelfCapacity,
      gemIds: [],
    },
    selection: null,
    status: "playing",
  };

  return { ...state, status: isWon(state) ? "won" : "playing" };
}

export function validateLevelSpec(spec: LevelSpec): void {
  if (spec.schemaVersion !== 1) {
    throw new LevelValidationError(`Unsupported schema version: ${spec.schemaVersion}`);
  }
  if (spec.rows <= 0 || spec.cols <= 0) {
    throw new LevelValidationError("Level dimensions must be positive");
  }
  if (spec.shelfCapacity <= 0 || spec.shelfCapacity % 12 !== 0) {
    throw new LevelValidationError("Shelf capacity must be a positive multiple of 12");
  }

  const occupiedCoordinates = new Set<string>();
  const gemIds = new Set<string>();
  const gemColorCounts = new Map<string, number>();
  const targetColorCounts = new Map<string, number>();

  for (const cell of spec.cells) {
    if (cell.row < 0 || cell.row >= spec.rows || cell.col < 0 || cell.col >= spec.cols) {
      throw new LevelValidationError(`Cell ${cell.row}:${cell.col} is outside board bounds`);
    }

    const coordinateKey = keyOf(cell);
    if (occupiedCoordinates.has(coordinateKey)) {
      throw new LevelValidationError(`Duplicate board cell at ${coordinateKey}`);
    }
    occupiedCoordinates.add(coordinateKey);

    if (gemIds.has(cell.gem.id)) {
      throw new LevelValidationError(`Duplicate gem id: ${cell.gem.id}`);
    }
    gemIds.add(cell.gem.id);

    gemColorCounts.set(cell.gem.color, (gemColorCounts.get(cell.gem.color) ?? 0) + 1);
    targetColorCounts.set(
      cell.targetColor,
      (targetColorCounts.get(cell.targetColor) ?? 0) + 1,
    );
  }

  const colors = new Set([...gemColorCounts.keys(), ...targetColorCounts.keys()]);
  for (const color of colors) {
    if (gemColorCounts.get(color) !== targetColorCounts.get(color)) {
      throw new LevelValidationError(`Color conservation failed for ${color}`);
    }
  }
}
