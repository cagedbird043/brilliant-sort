import type { CoreTransition } from "../core/port";
import type { Coord, GameCommand, GameState, GemId } from "../core/types";

export type DioramaLayoutMode = "landscape" | "portrait";

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DioramaBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export type DioramaTarget =
  | { readonly kind: "gem"; readonly gemId: GemId }
  | { readonly kind: "board"; readonly coord: Coord }
  | { readonly kind: "shelf"; readonly index: number };

export interface DioramaBoardCellLayout {
  readonly coord: Coord;
  readonly target: WorldPoint;
}

export interface DioramaShelfSlotLayout {
  readonly index: number;
  readonly position: WorldPoint;
}

export interface DioramaSceneLayout {
  readonly mode: DioramaLayoutMode;
  readonly boardCells: readonly DioramaBoardCellLayout[];
  readonly shelfSlots: readonly DioramaShelfSlotLayout[];
  readonly gemPositions: Readonly<Record<GemId, WorldPoint>>;
  readonly bounds: DioramaBounds;
}

export interface DioramaCameraFit {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly near: number;
  readonly far: number;
}

export interface DioramaPick {
  readonly target: DioramaTarget;
  readonly clientX: number;
  readonly clientY: number;
}

export interface DioramaDiagnostics {
  readonly ready: boolean;
  readonly disposed: boolean;
  readonly activeCells: number;
  readonly shelfSlots: number;
  readonly gemInstances: number;
  readonly drawCalls: number;
  readonly pixelRatio: number;
  readonly activeMotions: number;
  readonly layoutMode: DioramaLayoutMode;
  readonly camera: DioramaCameraFit;
  readonly cameraZoom: number;
  readonly lastPick: DioramaPick | null;
  readonly levelId: string | null;
  readonly status: GameState["status"] | null;
}

export interface DioramaRendererPort {
  renderState(state: GameState): void;
  playTransition(
    before: GameState,
    transition: CoreTransition,
    command: GameCommand,
  ): Promise<void>;
  pick(clientX: number, clientY: number): DioramaPick | null;
  focus(target: DioramaTarget | null): void;
  reject(target: DioramaTarget | null): void;
  resetCamera(): void;
  setReducedMotion(reduced: boolean): void;
  snapshotDiagnostics(): DioramaDiagnostics;
  projectTarget(target: DioramaTarget): { readonly x: number; readonly y: number } | null;
  setPresentationTimeForTest(timeMs: number | null): void;
  dispose(): void;
}

export interface DioramaRendererOptions {
  readonly onContextLost: (message: string) => void;
}

export type DioramaRendererFactory = (
  canvas: HTMLCanvasElement,
  options: DioramaRendererOptions,
) => DioramaRendererPort;

export interface DioramaTestBridge {
  snapshot(): DioramaDiagnostics;
  projectTarget(target: DioramaTarget): { readonly x: number; readonly y: number } | null;
  setPresentationTimeForTest(timeMs: number | null): void;
}

declare global {
  interface Window {
    __BRILLIANT_SORT_3D__?: DioramaTestBridge;
  }
}
