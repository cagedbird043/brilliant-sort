import {
  chebyshevDistance,
  compareCoords,
  coordFromKey,
  keyOf,
  shelfCoord,
} from "./coords";
import { findConnectedComponent8, neighbors8 } from "./topology";
import type {
  BoardCell,
  Color,
  Coord,
  GameState,
  GemId,
  Selection,
} from "./types";

export interface GemLocation {
  readonly gemId: GemId;
  readonly coord: Coord;
}

function boardCellAt(state: GameState, coord: Coord): BoardCell | undefined {
  return state.board.cells[keyOf(coord)];
}

function shelfGemIdAt(state: GameState, coord: Coord): GemId | null {
  if (coord.row < 0 || coord.col < 0 || coord.col >= state.shelf.width) {
    return null;
  }

  const index = coord.row * state.shelf.width + coord.col;
  return state.shelf.gemIds[index] ?? null;
}

function compareByAnchor(anchor: Coord, left: Coord, right: Coord): number {
  return (
    chebyshevDistance(left, anchor) - chebyshevDistance(right, anchor) ||
    compareCoords(left, right)
  );
}

/** A board gem is locked precisely when its color already matches its target. */
export function isLocked(state: GameState, cell: BoardCell): boolean {
  if (cell.gemId === null) {
    return false;
  }

  return state.gems[cell.gemId]?.color === cell.targetColor;
}

/** Shelf gems are movable while they occupy a compact Shelf index. */
export function isMovableShelfIndex(state: GameState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.shelf.gemIds.length;
}

/** Board movability is derived from occupancy and the locked predicate. */
export function isMovableBoardCell(state: GameState, coord: Coord): boolean {
  const cell = boardCellAt(state, coord);
  return cell !== undefined && cell.gemId !== null && !isLocked(state, cell);
}

/**
 * Returns the maximal same-color movable Board component in deterministic BFS
 * order. Inactive cells, empty cells, locked gems, and other colors break paths.
 */
export function findBoardMovableComponent(
  state: GameState,
  start: Coord,
): readonly GemLocation[] {
  const startCell = boardCellAt(state, start);
  if (startCell === undefined || startCell.gemId === null || isLocked(state, startCell)) {
    return [];
  }

  const color = state.gems[startCell.gemId]?.color;
  if (color === undefined) {
    return [];
  }

  const coords = findConnectedComponent8(start, (coord) => {
    const cell = boardCellAt(state, coord);
    return (
      cell !== undefined &&
      cell.gemId !== null &&
      !isLocked(state, cell) &&
      state.gems[cell.gemId]?.color === color
    );
  });
  const component: GemLocation[] = [];

  for (const coord of coords) {
    const gemId = boardCellAt(state, coord)?.gemId;
    if (gemId !== null && gemId !== undefined) {
      component.push({ gemId, coord });
    }
  }

  return component;
}

/** Returns the maximal same-color Shelf component in deterministic BFS order. */
export function findShelfMovableComponent(
  state: GameState,
  startIndex: number,
): readonly GemLocation[] {
  if (!isMovableShelfIndex(state, startIndex)) {
    return [];
  }

  const start = shelfCoord(startIndex, state.shelf.width);
  const startGemId = state.shelf.gemIds[startIndex]!;
  const color = state.gems[startGemId]?.color;
  if (color === undefined) {
    return [];
  }

  const coords = findConnectedComponent8(start, (coord) => {
    const gemId = shelfGemIdAt(state, coord);
    return gemId !== null && state.gems[gemId]?.color === color;
  });
  const component: GemLocation[] = [];

  for (const coord of coords) {
    const gemId = shelfGemIdAt(state, coord);
    if (gemId !== null) {
      component.push({ gemId, coord });
    }
  }

  return component;
}

/** Resolves selected gem identities to their current physical source locations. */
export function getSelectionLocations(
  state: GameState,
  selection: Selection,
): readonly GemLocation[] {
  if (selection.container === "shelf") {
    const indicesByGemId = new Map<GemId, number>();
    state.shelf.gemIds.forEach((gemId, index) => indicesByGemId.set(gemId, index));

    return selection.gemIds.flatMap((gemId) => {
      const index = indicesByGemId.get(gemId);
      return index === undefined
        ? []
        : [{ gemId, coord: shelfCoord(index, state.shelf.width) }];
    });
  }

  const coordinatesByGemId = new Map<GemId, Coord>();
  for (const [cellKey, cell] of Object.entries(state.board.cells)) {
    if (cell.gemId !== null) {
      coordinatesByGemId.set(cell.gemId, coordFromKey(cellKey));
    }
  }

  return selection.gemIds.flatMap((gemId) => {
    const coord = coordinatesByGemId.get(gemId);
    return coord === undefined ? [] : [{ gemId, coord }];
  });
}

/**
 * Computes the accessible source boundary in the specified selection's current layout.
 * Candidates are sorted by the immutable selection-anchor priority.
 */
export function getExtractionCandidates(
  state: GameState,
  selection: Selection,
): readonly GemLocation[] {
  const locations = getSelectionLocations(state, selection);
  if (locations.length !== selection.gemIds.length) {
    return [];
  }

  const selectedCoordinates = new Set(locations.map((location) => keyOf(location.coord)));
  return locations
    .filter((location) =>
      neighbors8(location.coord).some(
        (neighbor) => !selectedCoordinates.has(keyOf(neighbor)),
      ),
    )
    .sort((left, right) =>
      compareByAnchor(selection.anchor, left.coord, right.coord),
    );
}

/**
 * Finds an empty matching target component and applies the destination priority
 * order required for batch placement.
 */
export function findEmptyTargetComponent(
  state: GameState,
  start: Coord,
  color: Color,
): readonly Coord[] {
  const startCell = boardCellAt(state, start);
  if (
    startCell === undefined ||
    startCell.gemId !== null ||
    startCell.targetColor !== color
  ) {
    return [];
  }

  return [...findConnectedComponent8(start, (coord) => {
    const cell = boardCellAt(state, coord);
    return cell !== undefined && cell.gemId === null && cell.targetColor === color;
  })].sort((left, right) => compareByAnchor(start, left, right));
}


/** The only baseline terminal condition. */
export function isWon(state: GameState): boolean {
  if (state.selection !== null || state.shelf.gemIds.length !== 0) {
    return false;
  }

  return Object.values(state.board.cells).every(
    (cell) =>
      cell.gemId !== null && state.gems[cell.gemId]?.color === cell.targetColor,
  );
}
