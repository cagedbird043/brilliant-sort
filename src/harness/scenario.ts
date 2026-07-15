import { createGameState } from "../core/level";
import type { GameState, LevelSpec } from "../core/types";
import { prismLevel } from "../fixtures";

const FIXTURES: Record<string, LevelSpec> = {
  [prismLevel.id]: prismLevel,
};

export function loadScenario(name: string): { readonly initialState: GameState; readonly level: LevelSpec } {
  const level = FIXTURES[name];
  if (!level) {
    throw new Error(`Unknown scenario: ${name}`);
  }

  return {
    level,
    initialState: createGameState(level),
  };
}

export function listScenarioNames(): readonly string[] {
  return Object.keys(FIXTURES).sort();
}
