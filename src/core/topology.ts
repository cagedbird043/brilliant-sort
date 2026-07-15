import { addCoord, keyOf, NEIGHBOR_DELTAS } from "./coords";
import type { Coord } from "./types";

export type CoordinatePredicate = (coord: Coord) => boolean;

/** Returns neighboring coordinates in the fixed clockwise order declared by the rules. */
export function neighbors8(coord: Coord): readonly Coord[] {
  return NEIGHBOR_DELTAS.map((delta) => addCoord(coord, delta));
}

/**
 * Finds a component with iterative BFS. The predicate owns all container and
 * bounds checks, which keeps this topology primitive usable for Board and Shelf.
 */
export function findConnectedComponent8(
  start: Coord,
  isEligible: CoordinatePredicate,
): readonly Coord[] {
  if (!isEligible(start)) {
    return [];
  }

  const visited = new Set<string>([keyOf(start)]);
  const queue: Coord[] = [start];
  const component: Coord[] = [];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const coord = queue[cursor]!;
    component.push(coord);

    for (const neighbor of neighbors8(coord)) {
      const neighborKey = keyOf(neighbor);
      if (!visited.has(neighborKey) && isEligible(neighbor)) {
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }
  }

  return component;
}

/** Returns whether zero or more coordinates form one eight-neighbor component. */
export function isConnected8(coords: readonly Coord[]): boolean {
  if (coords.length < 2) {
    return true;
  }

  const positions = new Set(coords.map(keyOf));
  const queue: Coord[] = [coords[0]!];
  const visited = new Set<string>([keyOf(coords[0]!)]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const neighbor of neighbors8(queue[cursor]!)) {
      const neighborKey = keyOf(neighbor);
      if (positions.has(neighborKey) && !visited.has(neighborKey)) {
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === positions.size;
}
