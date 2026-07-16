import type { CoreTransition } from "../core/port";
import type { GameCommand, GameState, GemId } from "../core/types";
import type { DioramaLayoutMode, WorldPoint } from "./contracts";
import { createDioramaLayout, sameWorldPoint } from "./layout";

export const STANDARD_MOTION_DURATION_MS = 280;
export const WAND_MOTION_DURATION_MS = 460;
export const VICTORY_SWEEP_DURATION_MS = 620;

export type DioramaMotionKind = "none" | "selection" | "placement" | "wand" | "replay";

export interface DioramaGemMotion {
  readonly gemId: GemId;
  readonly from: WorldPoint;
  readonly to: WorldPoint;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly arcHeight: number;
}

export interface DioramaMotionPlan {
  readonly kind: DioramaMotionKind;
  readonly accepted: boolean;
  readonly gemMotions: readonly DioramaGemMotion[];
  readonly durationMs: number;
  readonly victorySweep: boolean;
}

function hashId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function coordinateDelay(gemId: GemId, point: WorldPoint, limit: number): number {
  const coordinateHash = Math.imul(Math.round(point.x * 41), 31) ^ Math.round(point.y * 41);
  return (hashId(gemId) ^ coordinateHash) % limit;
}

function waveDelay(gemId: GemId, from: WorldPoint, to: WorldPoint): number {
  const distance = Math.round((Math.abs(from.x - to.x) + Math.abs(from.y - to.y)) * 10);
  return distance * 11 + coordinateDelay(gemId, to, 17);
}

function motionKind(command: GameCommand, changedGemCount: number): DioramaMotionKind {
  if (command.type === "restart-level") {
    return "replay";
  }
  if (command.type === "apply-global-wand") {
    return "wand";
  }
  return changedGemCount > 0 ? "placement" : "selection";
}

/**
 * A deterministic plan references only the authoritative before/after state.
 * It is deliberately unaware of renderer objects and therefore can be tested
 * without WebGL or a game-core implementation.
 */
export function planDioramaTransition(
  before: GameState,
  transition: CoreTransition,
  command: GameCommand,
  mode: DioramaLayoutMode,
): DioramaMotionPlan {
  if (transition.rejection !== null) {
    return {
      kind: "none",
      accepted: false,
      gemMotions: [],
      durationMs: 0,
      victorySweep: false,
    };
  }

  const beforeLayout = createDioramaLayout(before, mode);
  const afterLayout = createDioramaLayout(transition.state, mode);
  const isWand = command.type === "apply-global-wand";
  const durationMs = isWand ? WAND_MOTION_DURATION_MS : STANDARD_MOTION_DURATION_MS;
  const gemMotions = Object.keys(transition.state.gems)
    .sort()
    .flatMap((gemId): DioramaGemMotion[] => {
      const from = beforeLayout.gemPositions[gemId];
      const to = afterLayout.gemPositions[gemId];
      if (!from || !to || sameWorldPoint(from, to)) {
        return [];
      }
      return [
        {
          gemId,
          from,
          to,
          delayMs: isWand
            ? waveDelay(gemId, from, to)
            : coordinateDelay(gemId, to, 48),
          durationMs,
          arcHeight: isWand ? 0.64 : 0.34,
        },
      ];
    });
  const victorySweep = transition.events.some((event) => event.type === "won");
  const lastGemFinish = gemMotions.reduce(
    (latest, motion) => Math.max(latest, motion.delayMs + motion.durationMs),
    0,
  );
  const kind = motionKind(command, gemMotions.length);

  return {
    kind,
    accepted: true,
    gemMotions,
    durationMs: Math.max(lastGemFinish, victorySweep ? VICTORY_SWEEP_DURATION_MS : 0),
    victorySweep,
  };
}

/** Samples a planned crystal flight at a fixed elapsed time. */
export function sampleDioramaGemMotion(
  motion: DioramaGemMotion,
  elapsedMs: number,
): WorldPoint {
  const rawProgress = Math.max(0, Math.min(1, (elapsedMs - motion.delayMs) / motion.durationMs));
  if (rawProgress === 0) {
    return motion.from;
  }
  if (rawProgress === 1) {
    return motion.to;
  }
  const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
  return {
    x: motion.from.x + (motion.to.x - motion.from.x) * progress,
    y: motion.from.y + (motion.to.y - motion.from.y) * progress,
    z:
      motion.from.z +
      (motion.to.z - motion.from.z) * progress +
      Math.sin(Math.PI * progress) * motion.arcHeight,
  };
}
