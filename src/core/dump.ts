import { compareCoords, coordFromKey } from "./coords";
import type { GameState } from "./types";

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

/**
 * Serializes semantic gameplay state into a stable JSON form for UI adapters,
 * Harness traces, replay checkpoints, and byte-for-byte deterministic tests.
 */
export function canonicalDump(state: GameState): string {
  const cells = Object.entries(state.board.cells)
    .map(([cellKey, cell]) => ({ coord: coordFromKey(cellKey), cell }))
    .sort((left, right) => compareCoords(left.coord, right.coord))
    .map(({ coord, cell }) => ({
      row: coord.row,
      col: coord.col,
      targetColor: cell.targetColor,
      gemId: cell.gemId,
    }));
  const gems = Object.values(state.gems)
    .sort((left, right) => compareStrings(left.id, right.id))
    .map((gem) => ({ id: gem.id, color: gem.color }));
  const selection =
    state.selection === null
      ? null
      : {
          container: state.selection.container,
          anchor: {
            row: state.selection.anchor.row,
            col: state.selection.anchor.col,
          },
          color: state.selection.color,
          gemIds: [...state.selection.gemIds].sort(compareStrings),
        };

  return JSON.stringify({
    schemaVersion: state.schemaVersion,
    levelId: state.levelId,
    board: {
      rows: state.board.rows,
      cols: state.board.cols,
      cells,
    },
    gems,
    shelf: {
      width: state.shelf.width,
      capacity: state.shelf.capacity,
      gemIds: state.shelf.gemIds,
    },
    selection,
    status: state.status,
  });
}
