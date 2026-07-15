export { canonicalDump } from "./dump";
export { createGameState, LevelValidationError, validateLevelSpec } from "./level";
export { reduce } from "./reducer";
export {
  findBoardMovableComponent,
  findEmptyTargetComponent,
  findShelfMovableComponent,
  getExtractionCandidates,
  getSelectionLocations,
  isLocked,
  isMovableBoardCell,
  isMovableShelfIndex,
  isSelectionConnected,
  isWon,
} from "./selectors";
export { findConnectedComponent8, isConnected8, neighbors8 } from "./topology";
export type { CoreTransition, GameCoreFactory, GameCorePort } from "./port";
export type {
  Board,
  BoardCell,
  Color,
  Coord,
  GameCommand,
  GameEvent,
  GameState,
  Gem,
  GemId,
  LevelCellSpec,
  LevelSpec,
  ReduceResult,
  Rejection,
  RejectionCode,
  Selection,
  SelectionContainer,
  Shelf,
} from "./types";
