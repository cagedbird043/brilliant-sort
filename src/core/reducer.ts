import { keyOf, shelfCoord } from "./coords";
import {
  findBoardMovableComponent,
  findEmptyTargetComponent,
  findShelfMovableComponent,
  getExtractionCandidates,
  isWon,
  type GemLocation,
} from "./selectors";
import {
  COLORS,
  type Color,
  type GameCommand,
  type GameEvent,
  type GameState,
  type GemId,
  type RejectionCode,
  type ReduceResult,
  type Selection,
} from "./types";

function reject(
  state: GameState,
  code: RejectionCode,
  detail: string,
): ReduceResult {
  return {
    nextState: state,
    events: [],
    rejection: { code, detail },
  };
}

function cloneState(state: GameState): GameState {
  const cells: Record<string, GameState["board"]["cells"][string]> = {};
  for (const [cellKey, cell] of Object.entries(state.board.cells)) {
    cells[cellKey] = { ...cell };
  }

  const gems: Record<GemId, GameState["gems"][GemId]> = {};
  for (const [gemId, gem] of Object.entries(state.gems)) {
    gems[gemId] = { ...gem };
  }

  return {
    ...state,
    board: { ...state.board, cells },
    gems,
    shelf: { ...state.shelf, gemIds: [...state.shelf.gemIds] },
    selection:
      state.selection === null
        ? null
        : {
            ...state.selection,
            anchor: { ...state.selection.anchor },
            gemIds: [...state.selection.gemIds],
          },
  };
}

function removeSelectedGem(selection: Selection, gemId: GemId): Selection | null {
  const gemIds = selection.gemIds.filter((memberId) => memberId !== gemId);
  return gemIds.length === 0 ? null : { ...selection, gemIds };
}

function resolveStatus(
  previousState: GameState,
  nextState: GameState,
  events: readonly GameEvent[],
): ReduceResult {
  const status: GameState["status"] = isWon(nextState) ? "won" : "playing";
  const stateWithStatus = nextState.status === status ? nextState : { ...nextState, status };
  const wonNow = previousState.status !== "won" && status === "won";

  return {
    nextState: stateWithStatus,
    events: wonNow ? [...events, { type: "won" }] : events,
  };
}


function moveSelectionGemToBoard(
  state: GameState,
  selection: Selection,
  source: GemLocation,
  destination: { readonly row: number; readonly col: number },
): GameState {
  const destinationKey = keyOf(destination);
  const destinationCell = state.board.cells[destinationKey]!;
  const cells = { ...state.board.cells };
  cells[destinationKey] = { ...destinationCell, gemId: source.gemId };

  let shelf = state.shelf;
  if (selection.container === "board") {
    const sourceKey = keyOf(source.coord);
    const sourceCell = state.board.cells[sourceKey]!;
    cells[sourceKey] = { ...sourceCell, gemId: null };
  } else {
    const sourceIndex = source.coord.row * state.shelf.width + source.coord.col;
    const gemIds = [...state.shelf.gemIds];
    gemIds.splice(sourceIndex, 1);
    shelf = { ...state.shelf, gemIds };
  }

  return {
    ...state,
    board: { ...state.board, cells },
    shelf,
    selection: removeSelectedGem(selection, source.gemId),
  };
}

function moveSelectionGemToShelf(
  state: GameState,
  selection: Selection,
  source: GemLocation,
): GameState {
  const sourceKey = keyOf(source.coord);
  const sourceCell = state.board.cells[sourceKey]!;
  const cells = { ...state.board.cells, [sourceKey]: { ...sourceCell, gemId: null } };

  return {
    ...state,
    board: { ...state.board, cells },
    shelf: { ...state.shelf, gemIds: [...state.shelf.gemIds, source.gemId] },
    selection: removeSelectedGem(selection, source.gemId),
  };
}

function selectBoardGem(state: GameState, command: Extract<GameCommand, { type: "select-board-gem" }>): ReduceResult {
  const cell = state.board.cells[keyOf(command.coord)];
  if (cell === undefined || cell.gemId === null) {
    return reject(state, "no-selectable-gem", "The Board coordinate has no movable gem");
  }

  const gem = state.gems[cell.gemId];
  if (gem === undefined) {
    return reject(state, "no-selectable-gem", "The Board gem is not present in this state");
  }
  if (gem.color === cell.targetColor) {
    return reject(state, "locked-gem", "A gem matching its Board target is locked");
  }

  const component = findBoardMovableComponent(state, command.coord);
  if (component.length === 0) {
    return reject(state, "no-selectable-gem", "The Board coordinate has no movable component");
  }

  return {
    nextState: {
      ...state,
      selection: {
        container: "board",
        anchor: { ...command.coord },
        color: gem.color,
        gemIds: component.map((member) => member.gemId),
      },
    },
    events: [{ type: "selection-changed", detail: "board" }],
  };
}

function selectShelfGem(state: GameState, command: Extract<GameCommand, { type: "select-shelf-gem" }>): ReduceResult {
  const component = findShelfMovableComponent(state, command.index);
  if (component.length === 0) {
    return reject(state, "no-selectable-gem", "The Shelf index has no movable gem");
  }

  const gem = state.gems[component[0]!.gemId];
  if (gem === undefined) {
    return reject(state, "no-selectable-gem", "The Shelf gem is not present in this state");
  }

  return {
    nextState: {
      ...state,
      selection: {
        container: "shelf",
        anchor: shelfCoord(command.index, state.shelf.width),
        color: gem.color,
        gemIds: component.map((member) => member.gemId),
      },
    },
    events: [{ type: "selection-changed", detail: "shelf" }],
  };
}

function placeSelectionAtTarget(
  state: GameState,
  command: Extract<GameCommand, { type: "place-selection-at-target" }>,
): ReduceResult {
  const selection = state.selection;
  if (selection === null || selection.gemIds.length === 0) {
    return reject(state, "no-selection", "Select a component before placing it");
  }

  const targetCell = state.board.cells[keyOf(command.coord)];
  if (targetCell === undefined) {
    return reject(state, "invalid-target", "The target coordinate is not an active Board cell");
  }
  if (targetCell.gemId !== null) {
    return reject(state, "target-is-occupied", "The target Board cell already contains a gem");
  }
  if (targetCell.targetColor !== selection.color) {
    return reject(state, "target-color-mismatch", "The target color does not match the selection color");
  }

  const targets = findEmptyTargetComponent(state, command.coord, selection.color);
  let nextState = state;
  const events: GameEvent[] = [];

  for (const destination of targets) {
    const currentSelection = nextState.selection;
    if (currentSelection === null) {
      break;
    }

    const source = getExtractionCandidates(nextState, currentSelection)[0];
    if (source === undefined) {
      break;
    }

    nextState = moveSelectionGemToBoard(nextState, currentSelection, source, destination);
    events.push({
      type: "gem-placed",
      detail: `${source.gemId}->${destination.row}:${destination.col}`,
    });
    if (currentSelection.container === "shelf") {
      events.push({ type: "shelf-compacted", detail: source.gemId });
    }
  }

  return resolveStatus(state, nextState, events);
}

function placeSelectionInShelf(state: GameState): ReduceResult {
  const selection = state.selection;
  if (selection === null || selection.gemIds.length === 0) {
    return reject(state, "no-selection", "Select a Board component before moving it to the Shelf");
  }
  if (selection.container !== "board") {
    return reject(
      state,
      "selection-must-come-from-board",
      "Only a Board selection can be placed into the Shelf",
    );
  }

  const availableSlots = state.shelf.capacity - state.shelf.gemIds.length;
  if (availableSlots <= 0) {
    return reject(state, "shelf-full", "The Shelf has no free slots");
  }

  let nextState = state;
  const events: GameEvent[] = [];

  for (let moved = 0; moved < availableSlots; moved += 1) {
    const currentSelection = nextState.selection;
    if (currentSelection === null) {
      break;
    }

    const source = getExtractionCandidates(nextState, currentSelection)[0];
    if (source === undefined) {
      break;
    }

    nextState = moveSelectionGemToShelf(nextState, currentSelection, source);
    events.push({ type: "gem-placed", detail: `${source.gemId}->shelf` });
  }

  return resolveStatus(state, nextState, events);
}

function applyGlobalWand(state: GameState): ReduceResult {
  const cells = { ...state.board.cells };
  const gemIdsByColor = Object.fromEntries(
    COLORS.map((color) => [color, [] as GemId[]]),
  ) as Record<Color, GemId[]>;
  const targetKeysByColor = Object.fromEntries(
    COLORS.map((color) => [color, [] as string[]]),
  ) as Record<Color, string[]>;
  let movedCount = 0;

  for (let row = 0; row < state.board.rows; row += 1) {
    for (let col = 0; col < state.board.cols; col += 1) {
      const cellKey = keyOf({ row, col });
      const cell = state.board.cells[cellKey];
      if (cell === undefined) {
        continue;
      }
      const gem = cell.gemId === null ? undefined : state.gems[cell.gemId];
      if (gem !== undefined && gem.color === cell.targetColor) {
        continue;
      }

      targetKeysByColor[cell.targetColor].push(cellKey);
      if (gem !== undefined) {
        gemIdsByColor[gem.color].push(gem.id);
        movedCount += 1;
      }
      cells[cellKey] = { ...cell, gemId: null };
    }
  }

  for (const gemId of state.shelf.gemIds) {
    const gem = state.gems[gemId];
    if (gem === undefined) {
      throw new Error(`Global wand cannot locate Shelf gem ${gemId}`);
    }
    gemIdsByColor[gem.color].push(gemId);
    movedCount += 1;
  }

  for (const color of COLORS) {
    const gemIds = gemIdsByColor[color].sort();
    const targetKeys = targetKeysByColor[color];
    if (gemIds.length !== targetKeys.length) {
      throw new Error(
        `Global wand color conservation failed for ${color}: ${gemIds.length} gems for ${targetKeys.length} targets`,
      );
    }
    targetKeys.forEach((cellKey, index) => {
      const cell = cells[cellKey]!;
      cells[cellKey] = { ...cell, gemId: gemIds[index]! };
    });
  }

  return resolveStatus(
    state,
    {
      ...state,
      board: { ...state.board, cells },
      shelf: { ...state.shelf, gemIds: [] },
      selection: null,
    },
    [{ type: "global-wand-applied", detail: String(movedCount) }],
  );
}

/**
 * Applies one deterministic command without mutating its input state. The
 * supplied initial state is used only by restart, so callers can replay safely.
 */
export function reduce(
  state: GameState,
  command: GameCommand,
  initialState: GameState,
): ReduceResult {
  if (command.type === "restart-level") {
    return { nextState: cloneState(initialState), events: [] };
  }
  if (state.status === "won") {
    return reject(state, "game-won", "Restart the level before issuing another command");
  }

  switch (command.type) {
    case "select-board-gem":
      return selectBoardGem(state, command);
    case "select-shelf-gem":
      return selectShelfGem(state, command);
    case "cancel-selection":
      if (state.selection === null) {
        return reject(state, "no-selection", "There is no active selection to cancel");
      }
      return resolveStatus(state, { ...state, selection: null }, [
        { type: "selection-cleared" },
      ]);
    case "place-selection-at-target":
      return placeSelectionAtTarget(state, command);
    case "place-selection-in-shelf":
      return placeSelectionInShelf(state);
    case "apply-global-wand":
      return applyGlobalWand(state);
  }
}
