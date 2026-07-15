import type { Coord } from "./types";

export const NEIGHBOR_DELTAS: readonly Coord[] = [
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: 1 },
  { row: 1, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: -1 },
  { row: 0, col: -1 },
  { row: -1, col: -1 },
];

export function keyOf({ row, col }: Coord): string {
  return `${row}:${col}`;
}

export function coordFromKey(key: string): Coord {
  const [row, col] = key.split(":").map(Number);
  return { row, col };
}

export function compareCoords(left: Coord, right: Coord): number {
  return left.row - right.row || left.col - right.col;
}

export function chebyshevDistance(left: Coord, right: Coord): number {
  return Math.max(Math.abs(left.row - right.row), Math.abs(left.col - right.col));
}

export function shelfCoord(index: number, width = 12): Coord {
  return { row: Math.floor(index / width), col: index % width };
}

export function addCoord(coord: Coord, delta: Coord): Coord {
  return { row: coord.row + delta.row, col: coord.col + delta.col };
}
