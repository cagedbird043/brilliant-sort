import { coordFromKey, keyOf } from "../core/coords";
import type { GameCommand, GameState } from "../core/types";
import type { DioramaTarget } from "./contracts";

/**
 * Resolve a rendered/semantic target to the one command understood by the
 * authoritative game core. The renderer and the DOM controls both call this
 * function; it deliberately does not inspect presentation state or mutate the
 * game snapshot.
 */
export function targetToCommand(
  target: DioramaTarget,
  state: GameState,
): GameCommand | null {
  if (state.status === "won") {
    return null;
  }

  if (target.kind === "gem") {
    for (const [cellKey, cell] of Object.entries(state.board.cells)) {
      if (cell.gemId === target.gemId) {
        return { type: "select-board-gem", coord: coordFromKey(cellKey) };
      }
    }

    const shelfIndex = state.shelf.gemIds.indexOf(target.gemId);
    return shelfIndex >= 0 ? { type: "select-shelf-gem", index: shelfIndex } : null;
  }

  if (target.kind === "board") {
    const cell = state.board.cells[keyOf(target.coord)];
    if (cell === undefined) {
      return null;
    }
    if (cell.gemId === null && state.selection !== null) {
      return { type: "place-selection-at-target", coord: target.coord };
    }
    return { type: "select-board-gem", coord: target.coord };
  }

  if (!Number.isInteger(target.index) || target.index < 0 || target.index >= state.shelf.capacity) {
    return null;
  }
  if (state.shelf.gemIds[target.index] !== undefined) {
    return { type: "select-shelf-gem", index: target.index };
  }
  return state.selection?.container === "board"
    ? { type: "place-selection-in-shelf" }
    : null;
}

