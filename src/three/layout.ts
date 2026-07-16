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
const SHELF_PITCH = 1.08;
const SHELF_GAP = 1.45;
const CAMERA_PADDING = 1.35;
const CAMERA_NEAR = -40;
const CAMERA_FAR = 80;

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
  const localIndex = index - bankStart;

  if (mode === "landscape") {
    const x =
      bank === 0
        ? boardBounds.minX - SHELF_GAP
        : boardBounds.maxX + SHELF_GAP;
    return {
      x,
      y: ((bankLength - 1) / 2 - localIndex) * SHELF_PITCH,
      z: -0.06,
    };
  }

  return {
    x: (localIndex - (bankLength - 1) / 2) * SHELF_PITCH,
    y: boardBounds.minY - SHELF_GAP - bank * SHELF_PITCH,
    z: -0.06,
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
