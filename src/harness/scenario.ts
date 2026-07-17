import { createGameState } from "../core/level";
import type { GameState, LevelSpec } from "../core/types";
import { chromeLevel, prismLevel, tuxLevel } from "../fixtures";

const FIXTURES: Record<string, LevelSpec> = {
  [chromeLevel.id]: chromeLevel,
  [prismLevel.id]: prismLevel,
  [tuxLevel.id]: tuxLevel,
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
