import type {
  GameCommand,
  GameEvent,
  GameState,
  LevelSpec,
  Rejection,
} from "./types";

export interface CoreTransition {
  readonly schemaVersion: 1;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly rejection: Rejection | null;
  readonly canonicalDump: string;
}

export interface GameCorePort {
  dispatch(command: GameCommand): CoreTransition;
  snapshot(): GameState;
  restart(): CoreTransition;
  destroy(): void;
}

export interface GameCoreFactory {
  load(level: LevelSpec): Promise<GameCorePort>;
}
