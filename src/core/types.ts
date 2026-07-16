export const COLORS = ["navy", "ice", "coral", "jade", "obsidian", "pearl", "amber"] as const;

export type Color = (typeof COLORS)[number];
export type GemId = string;

export interface Coord {
  readonly row: number;
  readonly col: number;
}

export interface Gem {
  readonly id: GemId;
  readonly color: Color;
}

export interface BoardCell {
  readonly targetColor: Color;
  readonly gemId: GemId | null;
}

export interface Board {
  readonly rows: number;
  readonly cols: number;
  readonly cells: Readonly<Record<string, BoardCell>>;
}

export interface Shelf {
  readonly width: number;
  readonly capacity: number;
  readonly gemIds: readonly GemId[];
}

export type SelectionContainer = "board" | "shelf";

export interface Selection {
  readonly container: SelectionContainer;
  readonly anchor: Coord;
  readonly color: Color;
  readonly gemIds: readonly GemId[];
}

export type GameStatus = "playing" | "won";

export interface GameState {
  readonly schemaVersion: 1;
  readonly levelId: string;
  readonly board: Board;
  readonly gems: Readonly<Record<GemId, Gem>>;
  readonly shelf: Shelf;
  readonly selection: Selection | null;
  readonly status: GameStatus;
}

export interface LevelCellSpec {
  readonly row: number;
  readonly col: number;
  readonly targetColor: Color;
  readonly gem: Gem;
}

export interface LevelSpec {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly rows: number;
  readonly cols: number;
  readonly shelfCapacity: number;
  readonly cells: readonly LevelCellSpec[];
}

export type GameCommand =
  | { readonly type: "select-board-gem"; readonly coord: Coord }
  | { readonly type: "select-shelf-gem"; readonly index: number }
  | { readonly type: "cancel-selection" }
  | { readonly type: "place-selection-at-target"; readonly coord: Coord }
  | { readonly type: "place-selection-in-shelf" }
  | { readonly type: "restart-level" };

export type RejectionCode =
  | "game-won"
  | "no-selectable-gem"
  | "locked-gem"
  | "no-selection"
  | "target-color-mismatch"
  | "target-is-occupied"
  | "invalid-target"
  | "shelf-full"
  | "selection-must-come-from-board";

export interface GameEvent {
  readonly type:
    | "selection-changed"
    | "selection-cleared"
    | "gem-placed"
    | "shelf-compacted"
    | "won";
  readonly detail?: string;
}

export interface Rejection {
  readonly code: RejectionCode;
  readonly detail: string;
}

export interface ReduceResult {
  readonly nextState: GameState;
  readonly events: readonly GameEvent[];
  readonly rejection?: Rejection;
}
