import { coordFromKey, keyOf } from "../core/coords";
import type { Coord, GameState, GemId } from "../core/types";
import type {
  DioramaBounds,
  DioramaCameraFit,
  DioramaLayoutMode,
  DioramaSceneLayout,
  DioramaTarget,
  WorldPoint,
} from "./contracts";

const CELL_SIZE = 1;
const SHELF_PITCH = 0.9;
const SHELF_GAP = 1.22;
const SHELF_BANK_GAP = 0.92;
const CAMERA_PADDING = 1.35;
const CAMERA_NEAR = -40;
const CAMERA_FAR = 80;

export const DIORAMA_SHELF_PITCH = SHELF_PITCH;

export interface DioramaShelfRailAnchor {
  readonly center: WorldPoint;
  readonly width: number;
}

export interface DioramaEdgeSegment {
  readonly from: WorldPoint;
  readonly to: WorldPoint;
}

export interface DioramaViewport {
  readonly width: number;
  readonly height: number;
}

export interface DioramaInstanceIdentity {
  readonly gemIds: readonly GemId[];
  readonly gemIndexById: Readonly<Record<GemId, number>>;
  readonly boardTargets: readonly DioramaTarget[];
  readonly shelfTargets: readonly DioramaTarget[];
}

function compareCoords(left: Coord, right: Coord): number {
  return left.row - right.row || left.col - right.col;
}

function pointEquals(left: WorldPoint | undefined, right: WorldPoint | undefined): boolean {
  return Boolean(
    left &&
      right &&
      left.x === right.x &&
      left.y === right.y &&
      left.z === right.z,
  );
}

function finitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function boardCoordinates(state: GameState): readonly Coord[] {
  return Object.keys(state.board.cells)
    .map(coordFromKey)
    .sort(compareCoords);
}

function boardPoint(state: GameState, coord: Coord): WorldPoint {
  return {
    x: (coord.col - (state.board.cols - 1) / 2) * CELL_SIZE,
    y: ((state.board.rows - 1) / 2 - coord.row) * CELL_SIZE,
    z: 0,
  };
}

function boundsFromPoints(points: readonly WorldPoint[]): DioramaBounds {
  if (points.length === 0) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function shelfPosition(
  index: number,
  capacity: number,
  mode: DioramaLayoutMode,
  boardBounds: DioramaBounds,
): WorldPoint {
  const splitIndex = Math.ceil(capacity / 2);
  const bank = index < splitIndex ? 0 : 1;
  const bankStart = bank === 0 ? 0 : splitIndex;
  const bankLength = bank === 0 ? splitIndex : capacity - splitIndex;
  const firstBankLength = splitIndex;
  const secondBankLength = capacity - splitIndex;
  const localIndex = index - bankStart;
  const boardCenterX = (boardBounds.minX + boardBounds.maxX) / 2;
  const boardMinY = boardBounds.minY;

  if (mode === "landscape") {
    const firstSpan = Math.max(0, firstBankLength - 1) * SHELF_PITCH;
    const secondSpan = Math.max(0, secondBankLength - 1) * SHELF_PITCH;
    const totalSpan = firstSpan + SHELF_BANK_GAP + secondSpan;
    const bankSpan = bank === 0 ? firstSpan : secondSpan;
    const bankCenter =
      bank === 0
        ? boardCenterX - totalSpan / 2 + bankSpan / 2
        : boardCenterX + totalSpan / 2 - bankSpan / 2;
    return {
      x: bankCenter + (localIndex - (bankLength - 1) / 2) * SHELF_PITCH,
      y: boardMinY - SHELF_GAP,
      z: -0.08,
    };
  }

  return {
    x: boardCenterX + (localIndex - (bankLength - 1) / 2) * SHELF_PITCH,
    y: boardMinY - SHELF_GAP - bank * SHELF_BANK_GAP,
    z: -0.08,
  };
}

/**
 * Chooses the only two world compositions the renderer supports. The world is
 * deliberately independent of CSS pixels so a state has identical geometry at
 * any DPR.
 */
export function getDioramaLayoutMode(viewport: DioramaViewport): DioramaLayoutMode {
  finitePositive(viewport.width, "Viewport width");
  finitePositive(viewport.height, "Viewport height");
  return viewport.width >= viewport.height ? "landscape" : "portrait";
}

/**
 * Produces all game-owned coordinates without deciding any game rule. Board
 * rows are inverted in world space to keep the top of the source map at the
 * visual top of the diorama.
 */
export function createDioramaLayout(
  state: GameState,
  mode: DioramaLayoutMode,
): DioramaSceneLayout {
  finitePositive(state.board.rows, "Board rows");
  finitePositive(state.board.cols, "Board columns");
  finitePositive(state.shelf.capacity, "Shelf capacity");

  const coordinates = boardCoordinates(state);
  const boardCells = coordinates.map((coord) => ({
    coord,
    target: boardPoint(state, coord),
  }));
  const boardBounds = boundsFromPoints(boardCells.map((cell) => cell.target));
  const shelfSlots = Array.from({ length: state.shelf.capacity }, (_, index) => ({
    index,
    position: shelfPosition(index, state.shelf.capacity, mode, boardBounds),
  }));

  const gemPositions: Record<GemId, WorldPoint> = {};
  for (const cell of boardCells) {
    const gemId = state.board.cells[keyOf(cell.coord)]?.gemId;
    if (gemId !== null && gemId !== undefined) {
      gemPositions[gemId] = { x: cell.target.x, y: cell.target.y, z: 0.31 };
    }
  }
  state.shelf.gemIds.forEach((gemId, index) => {
    const slot = shelfSlots[index];
    if (slot) {
      gemPositions[gemId] = { x: slot.position.x, y: slot.position.y, z: 0.27 };
    }
  });

  return {
    mode,
    boardCells,
    shelfSlots,
    gemPositions,
    bounds: boundsFromPoints([
      ...boardCells.map((cell) => cell.target),
      ...shelfSlots.map((slot) => slot.position),
    ]),
  };
}

/**
 * Returns the visual anchors for the two horizontal Shelf rails. Anchors are
 * derived from slot positions so the renderer never re-implements responsive
 * bank spacing.
 */
export function getDioramaShelfRailAnchors(
  layout: DioramaSceneLayout,
): readonly DioramaShelfRailAnchor[] {
  const splitIndex = Math.ceil(layout.shelfSlots.length / 2);
  const anchors: DioramaShelfRailAnchor[] = [];
  for (const [start, end] of [
    [0, splitIndex],
    [splitIndex, layout.shelfSlots.length],
  ] as const) {
    const slots = layout.shelfSlots.slice(start, end);
    if (slots.length === 0) {
      continue;
    }
    const minX = Math.min(...slots.map((slot) => slot.position.x));
    const maxX = Math.max(...slots.map((slot) => slot.position.x));
    const centerY = slots.reduce((sum, slot) => sum + slot.position.y, 0) / slots.length;
    anchors.push({
      center: { x: (minX + maxX) / 2, y: centerY, z: -0.15 },
      width: Math.max(SHELF_PITCH, maxX - minX + SHELF_PITCH),
    });
  }
  return anchors;
}

/**
 * Computes one batched line segment for every exposed edge of the active Board
 * silhouette. The result is pure world data and remains stable for a level.
 */
export function getDioramaExposedEdgeSegments(state: GameState): readonly DioramaEdgeSegment[] {
  const segments: DioramaEdgeSegment[] = [];
  const hasCell = (row: number, col: number): boolean =>
    Object.prototype.hasOwnProperty.call(state.board.cells, keyOf({ row, col }));
  const coordinates = boardCoordinates(state);
  for (const coord of coordinates) {
    const point = boardPoint(state, coord);
    const edges: readonly [Coord, WorldPoint, WorldPoint][] = [
      [
        { row: coord.row - 1, col: coord.col },
        { x: point.x - CELL_SIZE / 2, y: point.y + CELL_SIZE / 2, z: 0.13 },
        { x: point.x + CELL_SIZE / 2, y: point.y + CELL_SIZE / 2, z: 0.13 },
      ],
      [
        { row: coord.row, col: coord.col + 1 },
        { x: point.x + CELL_SIZE / 2, y: point.y + CELL_SIZE / 2, z: 0.13 },
        { x: point.x + CELL_SIZE / 2, y: point.y - CELL_SIZE / 2, z: 0.13 },
      ],
      [
        { row: coord.row + 1, col: coord.col },
        { x: point.x + CELL_SIZE / 2, y: point.y - CELL_SIZE / 2, z: 0.13 },
        { x: point.x - CELL_SIZE / 2, y: point.y - CELL_SIZE / 2, z: 0.13 },
      ],
      [
        { row: coord.row, col: coord.col - 1 },
        { x: point.x - CELL_SIZE / 2, y: point.y - CELL_SIZE / 2, z: 0.13 },
        { x: point.x - CELL_SIZE / 2, y: point.y + CELL_SIZE / 2, z: 0.13 },
      ],
    ];
    for (const [neighbor, from, to] of edges) {
      if (!hasCell(neighbor.row, neighbor.col)) {
        segments.push({ from, to });
      }
    }
  }
  return segments;
}

/**
 * Allocates identity from immutable level data, never the order in which a
 * command happens to move gems through the Shelf.
 */
export function createDioramaInstanceIdentity(state: GameState): DioramaInstanceIdentity {
  const gemIds = Object.keys(state.gems).sort();
  const gemIndexById: Record<GemId, number> = {};
  gemIds.forEach((gemId, index) => {
    gemIndexById[gemId] = index;
  });

  const boardTargets = boardCoordinates(state).map((coord) => ({
    kind: "board" as const,
    coord: { row: coord.row, col: coord.col },
  }));
  const shelfTargets = Array.from({ length: state.shelf.capacity }, (_, index) => ({
    kind: "shelf" as const,
    index,
  }));

  return { gemIds, gemIndexById, boardTargets, shelfTargets };
}

export function dioramaTargetKey(target: DioramaTarget): string {
  switch (target.kind) {
    case "gem":
      return `gem:${target.gemId}`;
    case "board":
      return `board:${target.coord.row}:${target.coord.col}`;
    case "shelf":
      return `shelf:${target.index}`;
  }
}

/**
 * Fits an orthographic frustum to a 2D world bounds rectangle with symmetric
 * padding. Frustum coordinates intentionally retain the world centre, which
 * keeps the camera target stable when portrait Shelf rows are introduced.
 */
export function calculateDioramaCameraFit(
  bounds: DioramaBounds,
  viewport: DioramaViewport,
  padding = CAMERA_PADDING,
): DioramaCameraFit {
  finitePositive(viewport.width, "Viewport width");
  finitePositive(viewport.height, "Viewport height");
  if (!Number.isFinite(padding) || padding < 0) {
    throw new RangeError("Camera padding must be non-negative");
  }
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxY) ||
    bounds.minX > bounds.maxX ||
    bounds.minY > bounds.maxY
  ) {
    throw new RangeError("Camera bounds must be finite and ordered");
  }

  const aspect = viewport.width / viewport.height;
  const worldWidth = Math.max(CELL_SIZE, bounds.maxX - bounds.minX + padding * 2);
  const worldHeight = Math.max(CELL_SIZE, bounds.maxY - bounds.minY + padding * 2);
  const frustumWidth = Math.max(worldWidth, worldHeight * aspect);
  const frustumHeight = frustumWidth / aspect;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    left: centerX - frustumWidth / 2,
    right: centerX + frustumWidth / 2,
    top: centerY + frustumHeight / 2,
    bottom: centerY - frustumHeight / 2,
    near: CAMERA_NEAR,
    far: CAMERA_FAR,
  };
}

export function sameWorldPoint(left: WorldPoint | undefined, right: WorldPoint | undefined): boolean {
  return pointEquals(left, right);
}
