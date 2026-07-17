import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color as ThreeColor,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  OrthographicCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { keyOf } from "../core/coords";
import type { CoreTransition } from "../core/port";
import type { Color as GameColor, GameCommand, GameState, GemId } from "../core/types";
import type {
  DioramaCameraFit,
  DioramaDiagnostics,
  DioramaLayoutMode,
  DioramaPick,
  DioramaRendererFactory,
  DioramaRendererOptions,
  DioramaRendererPort,
  DioramaSceneLayout,
  DioramaTarget,
  WorldPoint,
} from "./contracts";
import {
  calculateDioramaCameraFit,
  createDioramaInstanceIdentity,
  createDioramaLayout,
  dioramaTargetKey,
  getDioramaLayoutMode,
  type DioramaInstanceIdentity,
  type DioramaViewport,
} from "./layout";
import {
  planDioramaTransition,
  sampleDioramaGemMotion,
  type DioramaMotionPlan,
} from "./motion";

const PALETTE: Record<GameColor, number> = {
  navy: 0x5567c2,
  ice: 0x4ca9c8,
  coral: 0xbb686c,
  jade: 0x579b79,
  obsidian: 0x33425d,
  pearl: 0xdce4ef,
  amber: 0xd47d1f,
};
const GAME_COLORS: readonly GameColor[] = [
  "navy",
  "ice",
  "coral",
  "jade",
  "obsidian",
  "pearl",
  "amber",
];
const VOID = 0x050814;
const WORKBENCH = 0x111a32;
const FOCUS_CYAN = 0x4ca9c8;
const REJECTION_CORAL = 0xbb686c;
const MAX_PIXEL_RATIO = 2;
const REJECTION_DURATION_MS = 260;
const GEM_SCALE = 0.72;
const LOCKED_GEM_SCALE = 0.63;
const SELECTED_GEM_LIFT = 0.22;
const FOCUS_GEM_LIFT = 0.11;
const HIDDEN_SCALE = 0.00001;

interface SocketGroup {
  readonly mesh: InstancedMesh;
  readonly targets: readonly DioramaTarget[];
}

interface GemGroup {
  readonly mesh: InstancedMesh;
  readonly gemIds: readonly GemId[];
  readonly instanceByGemId: ReadonlyMap<GemId, number>;
}

interface ActiveMotion {
  readonly plan: DioramaMotionPlan;
  startMs: number;
  readonly resolve: () => void;
}

interface GemRenderState {
  readonly lockedGemIds: ReadonlySet<GemId>;
  readonly selectedGemIds: ReadonlySet<GemId>;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function levelSignature(state: GameState): string {
  const cells = Object.entries(state.board.cells)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([coord, cell]) => `${coord}:${cell.targetColor}`)
    .join(",");
  const gems = Object.keys(state.gems)
    .sort()
    .map((gemId) => `${gemId}:${state.gems[gemId]?.color ?? "missing"}`)
    .join(",");
  return `${state.levelId}|${state.board.rows}x${state.board.cols}|${state.shelf.capacity}|${cells}|${gems}`;
}

/**
 * Imperative native Three.js renderer. Its only mutable game-facing input is a
 * GameState snapshot supplied by the authoritative core; no scene object owns
 * selection, connectivity, placement, or victory rules.
 */
class DioramaRenderer implements DioramaRendererPort {
  private readonly scene = new Scene();
  private readonly renderer: WebGLRenderer;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, -40, 80);
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchPosition = new Vector3();
  private readonly scratchScale = new Vector3();
  private readonly scratchQuaternion = new Quaternion();
  private readonly scratchEuler = new Euler();
  private readonly scratchColor = new ThreeColor();
  private readonly scratchProjection = new Vector3();
  private readonly focusColor = new ThreeColor(FOCUS_CYAN);
  private readonly rejectionColor = new ThreeColor(REJECTION_CORAL);
  private readonly resizeObserver: ResizeObserver;
  private readonly contextLostListener: (event: Event) => void;
  private readonly contextRestoredListener: () => void;
  private readonly wheelListener: (event: WheelEvent) => void;
  private readonly options: DioramaRendererOptions;
  private readonly socketGroups = new Map<GameColor, SocketGroup>();
  private readonly gemGroups = new Map<GameColor, GemGroup>();
  private readonly gemGroupById = new Map<GemId, GemGroup>();
  private readonly pickTargets = new Map<InstancedMesh, readonly DioramaTarget[]>();
  private readonly pickMeshes: InstancedMesh[] = [];
  private readonly ownedGeometries = new Set<BufferGeometry>();
  private readonly ownedMaterials = new Set<Material>();
  private readonly motionPositions = new Map<GemId, WorldPoint>();
  private readonly caveGroup = new Group();
  private readonly floor: Mesh;
  private readonly backdrop: Mesh;
  private readonly caveRocks: InstancedMesh;
  private readonly wand: Group;
  private readonly victoryLight = new PointLight(FOCUS_CYAN, 0, 18);
  private readonly keyLight = new DirectionalLight(0xdce4ef, 2.2);
  private readonly fillLight = new DirectionalLight(FOCUS_CYAN, 1.15);

  private currentState: GameState | null = null;
  private identity: DioramaInstanceIdentity | null = null;
  private signature: string | null = null;
  private layoutMode: DioramaLayoutMode = "landscape";
  private cameraFit: DioramaCameraFit = {
    left: -1,
    right: 1,
    top: 1,
    bottom: -1,
    near: -40,
    far: 80,
  };
  private viewport: DioramaViewport = { width: 1, height: 1 };
  private cameraZoom = 1;
  private pixelRatio = 1;
  private lastPick: DioramaPick | null = null;
  private focusedTarget: DioramaTarget | null = null;
  private rejectedTarget: DioramaTarget | null = null;
  private rejectionUntilMs = 0;
  private activeMotion: ActiveMotion | null = null;
  private presentationTimeMs: number | null = null;
  private animationFrame: number | null = null;
  private disposed = false;
  private contextLost = false;
  private sceneReady = false;

  constructor(canvas: HTMLCanvasElement, options: DioramaRendererOptions) {
    this.options = options;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(VOID, 1);
    this.scene.background = new ThreeColor(VOID);
    this.camera.position.set(0.9, 1.25, 25);
    this.camera.lookAt(0, 0, 0);

    const floorGeometry = this.trackGeometry(new BoxGeometry(1, 1, 0.13));
    const floorMaterial = this.trackMaterial(
      new MeshStandardMaterial({ color: WORKBENCH, roughness: 0.92, metalness: 0.04, flatShading: true }),
    );
    this.floor = new Mesh(floorGeometry, floorMaterial);
    this.floor.position.z = -0.3;

    const backdropGeometry = this.trackGeometry(new PlaneGeometry(1, 1));
    const backdropMaterial = this.trackMaterial(
      new MeshStandardMaterial({ color: 0x0b142a, roughness: 1, metalness: 0, flatShading: true }),
    );
    this.backdrop = new Mesh(backdropGeometry, backdropMaterial);
    this.backdrop.position.z = -0.72;

    const rockGeometry = this.trackGeometry(new DodecahedronGeometry(0.82, 0));
    const rockMaterial = this.trackMaterial(
      new MeshStandardMaterial({ color: 0x1a3154, roughness: 0.78, metalness: 0.12, flatShading: true }),
    );
    this.caveRocks = new InstancedMesh(rockGeometry, rockMaterial, 4);
    this.caveRocks.instanceMatrix.setUsage(DynamicDrawUsage);

    const wandStemGeometry = this.trackGeometry(new CylinderGeometry(0.065, 0.09, 1.18, 5));
    const wandStemMaterial = this.trackMaterial(
      new MeshStandardMaterial({ color: 0xdce4ef, roughness: 0.46, metalness: 0.42, flatShading: true }),
    );
    const wandStem = new Mesh(wandStemGeometry, wandStemMaterial);
    wandStem.rotation.z = -0.48;
    const wandTipGeometry = this.trackGeometry(new OctahedronGeometry(0.22, 0));
    const wandTipMaterial = this.trackMaterial(
      new MeshStandardMaterial({ color: FOCUS_CYAN, emissive: 0x12263a, roughness: 0.35, metalness: 0.2, flatShading: true }),
    );
    const wandTip = new Mesh(wandTipGeometry, wandTipMaterial);
    wandTip.position.set(0.27, 0.53, 0.06);
    this.wand = new Group();
    this.wand.add(wandStem, wandTip);

    this.caveGroup.add(this.backdrop, this.floor, this.caveRocks, this.wand);
    this.scene.add(this.caveGroup);
    this.scene.add(this.victoryLight);
    this.scene.add(new AmbientLight(0x7f92b2, 0.86));
    this.keyLight.position.set(-8, 12, 18);
    this.fillLight.position.set(10, 2, 12);
    this.scene.add(this.keyLight, this.fillLight);

    this.contextLostListener = (event) => {
      event.preventDefault();
      if (this.disposed) {
        return;
      }
      this.contextLost = true;
      this.sceneReady = false;
      this.finishActiveMotion();
      this.options.onContextLost("3D canvas context was lost. Reload the 3D scene to continue.");
    };
    this.contextRestoredListener = () => {
      if (this.disposed) {
        return;
      }
      this.options.onContextLost("3D canvas context was restored. Restart the 3D scene to rebuild its GPU resources.");
    };
    canvas.addEventListener("webglcontextlost", this.contextLostListener);
    canvas.addEventListener("webglcontextrestored", this.contextRestoredListener);
    this.wheelListener = (event) => {
      if (this.disposed || this.layoutMode !== "landscape") {
        return;
      }
      event.preventDefault();
      const nextZoom = Math.max(0.9, Math.min(1.18, this.cameraZoom - event.deltaY * 0.0005));
      if (nextZoom === this.cameraZoom) {
        return;
      }
      this.cameraZoom = nextZoom;
      this.camera.zoom = nextZoom;
      this.camera.updateProjectionMatrix();
      this.render();
    };
    canvas.addEventListener("wheel", this.wheelListener, { passive: false });

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      this.resize(entry.contentRect.width, entry.contentRect.height);
    });
    this.resizeObserver.observe(canvas);
    const rect = canvas.getBoundingClientRect();
    this.resize(rect.width || canvas.clientWidth || 1, rect.height || canvas.clientHeight || 1);

  }

  renderState(state: GameState): void {
    if (this.disposed || this.contextLost) {
      return;
    }
    this.finishActiveMotion();
    this.currentState = state;
    const nextSignature = levelSignature(state);
    const nextMode = getDioramaLayoutMode(this.viewport);
    const needsRebuild = nextSignature !== this.signature;
    const modeChanged = nextMode !== this.layoutMode;
    this.layoutMode = nextMode;

    if (needsRebuild) {
      this.clearGameplayMeshes();
      this.signature = nextSignature;
      this.identity = createDioramaInstanceIdentity(state);
    }
    const layout = createDioramaLayout(state, this.layoutMode);
    this.currentLayout = layout;

    if (needsRebuild) {
      this.buildGameplayMeshes(state);
    }
    if (needsRebuild || modeChanged) {
      this.updateStaticLayout(state);
    }
    this.applyStateTransforms();
    this.sceneReady = true;
    this.render();
  }

  playTransition(
    before: GameState,
    transition: CoreTransition,
    command: GameCommand,
  ): Promise<void> {
    if (this.disposed || this.contextLost) {
      return Promise.resolve();
    }
    this.renderState(before);

    if (transition.rejection !== null) {
      this.reject(this.targetForCommand(before, command));
      return Promise.resolve();
    }

    if (command.type === "restart-level") {
      this.resetCamera();
    }
    const plan = planDioramaTransition(before, transition, command, this.layoutMode);
    this.currentState = transition.state;
    this.currentLayout = createDioramaLayout(transition.state, this.layoutMode);
    this.applyStateTransforms();

    if (this.reducedMotion || plan.durationMs === 0) {
      this.victoryLight.intensity = 0;
      this.render();
      return Promise.resolve();
    }

    this.motionPositions.clear();
    for (const motion of plan.gemMotions) {
      this.motionPositions.set(motion.gemId, motion.from);
    }
    this.applyGemTransforms(this.motionPositions);
    this.render();

    const gate = Promise.withResolvers<void>();
    this.activeMotion = {
      plan,
      startMs: this.presentationNow(),
      resolve: gate.resolve,
    };
    this.advanceFrame();
    return gate.promise;
  }

  pick(clientX: number, clientY: number): DioramaPick | null {
    if (this.disposed || this.contextLost || !this.sceneReady) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersection = this.raycaster.intersectObjects(this.pickMeshes, false)[0];
    if (!intersection || !(intersection.object instanceof InstancedMesh) || intersection.instanceId === undefined) {
      this.lastPick = null;
      return null;
    }
    const target = this.pickTargets.get(intersection.object)?.[intersection.instanceId];
    if (!target) {
      this.lastPick = null;
      return null;
    }
    const pick = { target, clientX, clientY };
    this.lastPick = pick;
    return pick;
  }

  focus(target: DioramaTarget | null): void {
    if (this.disposed) {
      return;
    }
    this.focusedTarget = target;
    this.applyStateTransforms();
    this.render();
  }

  reject(target: DioramaTarget | null): void {
    if (this.disposed || target === null) {
      return;
    }
    this.rejectedTarget = target;
    this.rejectionUntilMs = this.presentationNow() + REJECTION_DURATION_MS;
    this.applyStateTransforms();
    this.render();
    this.scheduleFrame();
  }

  resetCamera(): void {
    if (this.disposed) {
      return;
    }
    this.cameraZoom = 1;
    this.applyCameraFit();
    this.render();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) {
      this.finishActiveMotion();
      this.applyStateTransforms();
      this.victoryLight.intensity = 0;
      this.render();
    }
  }

  snapshotDiagnostics(): DioramaDiagnostics {
    return {
      ready: this.sceneReady && !this.disposed && !this.contextLost,
      disposed: this.disposed,
      activeCells: this.currentLayout?.boardCells.length ?? 0,
      shelfSlots: this.currentLayout?.shelfSlots.length ?? 0,
      gemInstances: this.identity?.gemIds.length ?? 0,
      drawCalls: this.renderer.info.render.calls,
      pixelRatio: this.pixelRatio,
      activeMotions: this.activeMotion
        ? this.activeMotion.plan.gemMotions.filter(
            (motion) => this.presentationNow() < this.activeMotion!.startMs + motion.delayMs + motion.durationMs,
          ).length
        : 0,
      layoutMode: this.layoutMode,
      camera: this.cameraFit,
      cameraZoom: this.cameraZoom,
      lastPick: this.lastPick,
      levelId: this.currentState?.levelId ?? null,
      status: this.currentState?.status ?? null,
    };
  }

  projectTarget(target: DioramaTarget): { readonly x: number; readonly y: number } | null {
    if (this.disposed || !this.currentLayout) {
      return null;
    }
    const point = this.pointForTarget(target);
    if (!point) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    this.scene.updateMatrixWorld(true);
    this.scratchProjection.set(point.x, point.y, point.z).project(this.camera);
    return {
      x: rect.left + ((this.scratchProjection.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - this.scratchProjection.y) * rect.height) / 2,
    };
  }

  setPresentationTimeForTest(timeMs: number | null): void {
    if (timeMs !== null && (!Number.isFinite(timeMs) || timeMs < 0)) {
      throw new RangeError("Presentation time must be a non-negative finite number or null");
    }
    const priorTime = this.presentationNow();
    this.presentationTimeMs = timeMs;
    if (timeMs === null && this.activeMotion) {
      this.activeMotion.startMs = performance.now() - Math.max(0, priorTime - this.activeMotion.startMs);
    }
    this.advanceFrame();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.finishActiveMotion();
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.contextLostListener);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.contextRestoredListener);
    this.renderer.domElement.removeEventListener("wheel", this.wheelListener);
    this.clearGameplayMeshes();
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private currentLayout: DioramaSceneLayout | null = null;
  private reducedMotion = false;

  private trackGeometry<T extends BufferGeometry>(geometry: T): T {
    this.ownedGeometries.add(geometry);
    return geometry;
  }

  private trackMaterial<T extends Material>(material: T): T {
    this.ownedMaterials.add(material);
    return material;
  }

  private resize(width: number, height: number): void {
    if (this.disposed) {
      return;
    }
    this.viewport = {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
    this.pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.viewport.width, this.viewport.height, false);
    if (!this.currentState) {
      this.render();
      return;
    }

    const nextMode = getDioramaLayoutMode(this.viewport);
    const modeChanged = nextMode !== this.layoutMode;
    if (modeChanged && nextMode === "portrait") {
      this.cameraZoom = 1;
    }
    this.layoutMode = nextMode;
    this.currentLayout = createDioramaLayout(this.currentState, this.layoutMode);
    if (modeChanged) {
      this.updateStaticLayout(this.currentState);
    }
    this.applyStateTransforms();
    this.render();
  }

  private buildGameplayMeshes(state: GameState): void {
    if (!this.currentLayout) {
      return;
    }
    const socketGeometry = this.trackGeometry(new CylinderGeometry(0.45, 0.52, 0.13, 6));
    socketGeometry.rotateX(Math.PI / 2);
    const gemGeometry = this.trackGeometry(new OctahedronGeometry(0.42, 0));
    const shelfGeometry = this.trackGeometry(new BoxGeometry(0.84, 0.84, 0.15));
    const shelfMaterial = this.trackMaterial(
      new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.74,
        metalness: 0.16,
        flatShading: true,
      }),
    );

    for (const color of GAME_COLORS) {
      const cells = this.currentLayout.boardCells.filter(
        (cell) => state.board.cells[keyOf(cell.coord)]?.targetColor === color,
      );
      if (cells.length > 0) {
        const socketMaterial = this.trackMaterial(
          new MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.72,
            metalness: 0.12,
            flatShading: true,
          }),
        );
        const socketMesh = new InstancedMesh(socketGeometry, socketMaterial, cells.length);
        socketMesh.instanceMatrix.setUsage(DynamicDrawUsage);
        socketMesh.frustumCulled = false;
        const targets = cells.map((cell) => ({
          kind: "board" as const,
          coord: { row: cell.coord.row, col: cell.coord.col },
        }));
        this.socketGroups.set(color, { mesh: socketMesh, targets });
        this.pickTargets.set(socketMesh, targets);
        this.pickMeshes.push(socketMesh);
        this.scene.add(socketMesh);
      }

      const gemIds = Object.keys(state.gems)
        .filter((gemId) => state.gems[gemId]?.color === color)
        .sort();
      if (gemIds.length > 0) {
        const gemMaterial = this.trackMaterial(
          new MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.38,
            metalness: 0.2,
            flatShading: true,
          }),
        );
        const gemMesh = new InstancedMesh(gemGeometry, gemMaterial, gemIds.length);
        gemMesh.instanceMatrix.setUsage(DynamicDrawUsage);
        gemMesh.frustumCulled = false;
        const instanceByGemId = new Map<GemId, number>();
        gemIds.forEach((gemId, index) => instanceByGemId.set(gemId, index));
        const group = { mesh: gemMesh, gemIds, instanceByGemId };
        this.gemGroups.set(color, group);
        gemIds.forEach((gemId) => this.gemGroupById.set(gemId, group));
        const targets = gemIds.map((gemId) => ({ kind: "gem" as const, gemId }));
        this.pickTargets.set(gemMesh, targets);
        this.pickMeshes.push(gemMesh);
        this.scene.add(gemMesh);
      }
    }

    const shelfMesh = new InstancedMesh(shelfGeometry, shelfMaterial, this.currentLayout.shelfSlots.length);
    shelfMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    shelfMesh.frustumCulled = false;
    const shelfTargets = this.currentLayout.shelfSlots.map((slot) => ({ kind: "shelf" as const, index: slot.index }));
    this.shelfMesh = shelfMesh;
    this.pickTargets.set(shelfMesh, shelfTargets);
    this.pickMeshes.push(shelfMesh);
    this.scene.add(shelfMesh);
  }

  private shelfMesh: InstancedMesh | null = null;

  private clearGameplayMeshes(): void {
    for (const group of this.socketGroups.values()) {
      this.disposeGameplayMesh(group.mesh);
    }
    for (const group of this.gemGroups.values()) {
      this.disposeGameplayMesh(group.mesh);
    }
    if (this.shelfMesh) {
      this.disposeGameplayMesh(this.shelfMesh);
      this.shelfMesh = null;
    }
    this.socketGroups.clear();
    this.gemGroups.clear();
    this.gemGroupById.clear();
    this.pickTargets.clear();
    this.pickMeshes.length = 0;
  }

  private disposeGameplayMesh(mesh: InstancedMesh): void {
    this.scene.remove(mesh);
    if (this.ownedGeometries.delete(mesh.geometry)) {
      mesh.geometry.dispose();
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (this.ownedMaterials.delete(material)) {
        material.dispose();
      }
    });
  }

  private updateStaticLayout(state: GameState): void {
    if (!this.currentLayout) {
      return;
    }
    for (const [color, group] of this.socketGroups) {
      group.targets.forEach((target, index) => {
        if (target.kind !== "board") {
          return;
        }
        const cell = this.currentLayout!.boardCells.find(
          (candidate) => candidate.coord.row === target.coord.row && candidate.coord.col === target.coord.col,
        );
        if (!cell) {
          return;
        }
        this.setInstanceTransform(group.mesh, index, cell.target, 1, 0);
        this.setScaledColor(group.mesh, index, PALETTE[color], 0.36);
      });
      group.mesh.instanceMatrix.needsUpdate = true;
      if (group.mesh.instanceColor) {
        group.mesh.instanceColor.needsUpdate = true;
      }
      group.mesh.computeBoundingSphere();
    }

    if (this.shelfMesh) {
      this.currentLayout.shelfSlots.forEach((slot, index) => {
        this.setInstanceTransform(this.shelfMesh!, index, slot.position, 1, 0);
        this.setScaledColor(this.shelfMesh!, index, WORKBENCH, 1);
      });
      this.shelfMesh.instanceMatrix.needsUpdate = true;
      if (this.shelfMesh.instanceColor) {
        this.shelfMesh.instanceColor.needsUpdate = true;
      }
      this.shelfMesh.computeBoundingSphere();
    }

    const bounds = this.currentLayout.bounds;
    const width = bounds.maxX - bounds.minX + 2.5;
    const height = bounds.maxY - bounds.minY + 2.5;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    this.floor.position.set(centerX, centerY, -0.31);
    this.floor.scale.set(width, height, 1);
    this.backdrop.position.set(centerX, centerY, -0.74);
    this.backdrop.scale.set(width, height, 1);

    const rockPositions = [
      { x: bounds.minX - 0.86, y: bounds.maxY + 0.18, z: -0.38, scale: 1.12 },
      { x: bounds.maxX + 0.84, y: bounds.maxY + 0.28, z: -0.42, scale: 0.94 },
      { x: bounds.minX - 0.68, y: bounds.minY - 0.56, z: -0.4, scale: 0.74 },
      { x: bounds.maxX + 0.72, y: bounds.minY - 0.48, z: -0.45, scale: 0.82 },
    ];
    rockPositions.forEach((rock, index) => {
      this.setInstanceTransform(this.caveRocks, index, rock, rock.scale, stableHash(`${index}`) * 0.0008);
    });
    this.caveRocks.instanceMatrix.needsUpdate = true;
    this.caveRocks.computeBoundingSphere();
    this.wand.position.set(bounds.maxX - 0.85, bounds.maxY + 0.18, 0.28);
    this.applyCameraFit();
    void state;
  }

  private applyCameraFit(): void {
    if (!this.currentLayout) {
      return;
    }
    this.cameraFit = calculateDioramaCameraFit(this.currentLayout.bounds, this.viewport);
    this.camera.left = this.cameraFit.left;
    this.camera.right = this.cameraFit.right;
    this.camera.top = this.cameraFit.top;
    this.camera.bottom = this.cameraFit.bottom;
    this.camera.near = this.cameraFit.near;
    this.camera.far = this.cameraFit.far;
    const centerX = (this.cameraFit.left + this.cameraFit.right) / 2;
    const centerY = (this.cameraFit.top + this.cameraFit.bottom) / 2;
    this.camera.position.set(centerX + 0.9, centerY + 1.25, 25);
    this.camera.lookAt(centerX, centerY, 0);
    this.camera.zoom = this.cameraZoom;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private applyStateTransforms(): void {
    if (!this.currentState || !this.currentLayout) {
      return;
    }
    this.wand.rotation.z = 0;
    this.wand.position.z = 0.28;
    this.applySocketTransforms();
    this.applyShelfTransforms();
    this.applyGemTransforms();
  }

  private applySocketTransforms(): void {
    if (!this.currentLayout) {
      return;
    }
    const rejectingKey = this.rejectedTarget && this.isRejecting() ? dioramaTargetKey(this.rejectedTarget) : null;
    const focusedKey = this.focusedTarget ? dioramaTargetKey(this.focusedTarget) : null;
    for (const [color, group] of this.socketGroups) {
      group.targets.forEach((target, index) => {
        if (target.kind !== "board") {
          return;
        }
        const cell = this.currentLayout!.boardCells.find(
          (candidate) => candidate.coord.row === target.coord.row && candidate.coord.col === target.coord.col,
        );
        if (!cell) {
          return;
        }
        const targetKey = dioramaTargetKey(target);
        const focused = targetKey === focusedKey;
        const rejecting = targetKey === rejectingKey;
        const pulse = rejecting ? this.rejectionPulse() : 1;
        this.setInstanceTransform(group.mesh, index, cell.target, (focused ? 1.11 : 1) * pulse, 0);
        this.setStateColor(group.mesh, index, PALETTE[color], 0.36, focused, rejecting);
      });
      group.mesh.instanceMatrix.needsUpdate = true;
      if (group.mesh.instanceColor) {
        group.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private applyShelfTransforms(): void {
    if (!this.currentLayout || !this.shelfMesh) {
      return;
    }
    const rejectingKey = this.rejectedTarget && this.isRejecting() ? dioramaTargetKey(this.rejectedTarget) : null;
    const focusedKey = this.focusedTarget ? dioramaTargetKey(this.focusedTarget) : null;
    this.currentLayout.shelfSlots.forEach((slot, index) => {
      const target = { kind: "shelf" as const, index: slot.index };
      const targetKey = dioramaTargetKey(target);
      const focused = targetKey === focusedKey;
      const rejecting = targetKey === rejectingKey;
      const pulse = rejecting ? this.rejectionPulse() : 1;
      this.setInstanceTransform(this.shelfMesh!, index, slot.position, (focused ? 1.08 : 1) * pulse, 0);
      this.setStateColor(this.shelfMesh!, index, WORKBENCH, 1, focused, rejecting);
    });
    this.shelfMesh.instanceMatrix.needsUpdate = true;
    if (this.shelfMesh.instanceColor) {
      this.shelfMesh.instanceColor.needsUpdate = true;
    }
  }

  private applyGemTransforms(overrides?: ReadonlyMap<GemId, WorldPoint>): void {
    if (!this.currentState) {
      return;
    }
    const gemState = this.gemRenderState();
    const rejectingKey = this.rejectedTarget && this.isRejecting() ? dioramaTargetKey(this.rejectedTarget) : null;
    const focusedKey = this.focusedTarget ? dioramaTargetKey(this.focusedTarget) : null;
    for (const [color, group] of this.gemGroups) {
      group.gemIds.forEach((gemId, index) => {
        const point = overrides?.get(gemId) ?? this.currentLayout?.gemPositions[gemId];
        if (!point) {
          this.setInstanceTransform(group.mesh, index, { x: 0, y: 0, z: -20 }, HIDDEN_SCALE, 0);
          return;
        }
        const target = { kind: "gem" as const, gemId };
        const focused = dioramaTargetKey(target) === focusedKey;
        const rejecting = dioramaTargetKey(target) === rejectingKey;
        const selected = gemState.selectedGemIds.has(gemId);
        const locked = gemState.lockedGemIds.has(gemId);
        const motionOverride = overrides?.has(gemId) ?? false;
        const z =
          point.z +
          (motionOverride ? 0 : selected ? SELECTED_GEM_LIFT : focused ? FOCUS_GEM_LIFT : locked ? -0.09 : 0);
        const pulse = rejecting ? this.rejectionPulse() : 1;
        this.setInstanceTransform(
          group.mesh,
          index,
          { x: point.x, y: point.y, z },
          (locked ? LOCKED_GEM_SCALE : GEM_SCALE) * (selected ? 1.13 : 1) * (focused ? 1.06 : 1) * pulse,
          stableHash(gemId) * 0.0007,
        );
        this.setStateColor(group.mesh, index, PALETTE[color], locked ? 0.72 : 1, selected || focused, rejecting);
      });
      group.mesh.instanceMatrix.needsUpdate = true;
      if (group.mesh.instanceColor) {
        group.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private gemRenderState(): GemRenderState {
    const lockedGemIds = new Set<GemId>();
    if (this.currentState) {
      for (const [coord, cell] of Object.entries(this.currentState.board.cells)) {
        if (cell.gemId && this.currentState.gems[cell.gemId]?.color === cell.targetColor) {
          lockedGemIds.add(cell.gemId);
        }
        void coord;
      }
    }
    return {
      lockedGemIds,
      selectedGemIds: new Set(this.currentState?.selection?.gemIds ?? []),
    };
  }

  private setInstanceTransform(
    mesh: InstancedMesh,
    index: number,
    point: WorldPoint,
    scale: number,
    rotationZ: number,
  ): void {
    this.scratchPosition.set(point.x, point.y, point.z);
    this.scratchScale.set(scale, scale, scale);
    this.scratchEuler.set(0.16, -0.12, rotationZ);
    this.scratchQuaternion.setFromEuler(this.scratchEuler);
    this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    mesh.setMatrixAt(index, this.scratchMatrix);
  }

  private setScaledColor(mesh: InstancedMesh, index: number, color: number, scale: number): void {
    this.scratchColor.setHex(color).multiplyScalar(scale);
    mesh.setColorAt(index, this.scratchColor);
  }

  private setStateColor(
    mesh: InstancedMesh,
    index: number,
    color: number,
    scale: number,
    focused: boolean,
    rejecting: boolean,
  ): void {
    this.scratchColor.setHex(color).multiplyScalar(scale);
    if (focused) {
      this.scratchColor.lerp(this.focusColor, 0.36);
    }
    if (rejecting) {
      this.scratchColor.lerp(this.rejectionColor, 0.58);
    }
    mesh.setColorAt(index, this.scratchColor);
  }

  private targetForCommand(before: GameState, command: GameCommand): DioramaTarget | null {
    switch (command.type) {
      case "select-board-gem": {
        const gemId = before.board.cells[keyOf(command.coord)]?.gemId;
        return gemId ? { kind: "gem", gemId } : { kind: "board", coord: command.coord };
      }
      case "select-shelf-gem": {
        const gemId = before.shelf.gemIds[command.index];
        return gemId ? { kind: "gem", gemId } : { kind: "shelf", index: command.index };
      }
      case "place-selection-at-target":
        return { kind: "board", coord: command.coord };
      case "place-selection-in-shelf":
        return before.selection?.gemIds[0] ? { kind: "gem", gemId: before.selection.gemIds[0] } : null;
      case "cancel-selection":
      case "apply-global-wand":
      case "restart-level":
        return null;
    }
  }

  private pointForTarget(target: DioramaTarget): WorldPoint | null {
    if (!this.currentLayout) {
      return null;
    }
    switch (target.kind) {
      case "gem":
        return this.currentLayout.gemPositions[target.gemId] ?? null;
      case "board":
        return (
          this.currentLayout.boardCells.find(
            (cell) => cell.coord.row === target.coord.row && cell.coord.col === target.coord.col,
          )?.target ?? null
        );
      case "shelf":
        return this.currentLayout.shelfSlots[target.index]?.position ?? null;
    }
  }

  private presentationNow(): number {
    return this.presentationTimeMs ?? performance.now();
  }

  private isRejecting(): boolean {
    return this.rejectedTarget !== null && this.presentationNow() < this.rejectionUntilMs;
  }

  private rejectionPulse(): number {
    const remaining = Math.max(0, this.rejectionUntilMs - this.presentationNow());
    const progress = 1 - remaining / REJECTION_DURATION_MS;
    return 1 + Math.sin(Math.PI * progress) * 0.11;
  }

  private advanceFrame(): void {
    if (this.disposed || this.contextLost) {
      return;
    }
    if (this.activeMotion) {
      const motion = this.activeMotion;
      const elapsedMs = Math.max(0, this.presentationNow() - motion.startMs);
      this.motionPositions.clear();
      for (const gemMotion of motion.plan.gemMotions) {
        this.motionPositions.set(gemMotion.gemId, sampleDioramaGemMotion(gemMotion, elapsedMs));
      }
      this.applySocketTransforms();
      this.applyShelfTransforms();
      this.applyGemTransforms(this.motionPositions);
      this.updateWand(motion.plan, elapsedMs);
      this.updateVictoryLight(motion.plan, elapsedMs);
      if (elapsedMs >= motion.plan.durationMs) {
        this.activeMotion = null;
        this.motionPositions.clear();
        this.victoryLight.intensity = 0;
        this.applyStateTransforms();
        motion.resolve();
      }
    } else if (this.rejectedTarget && !this.isRejecting()) {
      this.rejectedTarget = null;
      this.applyStateTransforms();
    } else if (this.rejectedTarget) {
      this.applyStateTransforms();
    }

    this.render();
    if (this.activeMotion || this.isRejecting()) {
      this.scheduleFrame();
    }
  }

  private updateWand(plan: DioramaMotionPlan, elapsedMs: number): void {
    if (plan.kind !== "wand") {
      return;
    }
    const wave = Math.min(1, elapsedMs / Math.max(1, plan.durationMs));
    this.wand.rotation.z = Math.sin(wave * Math.PI * 3) * 0.22;
    this.wand.position.z = 0.28 + Math.sin(wave * Math.PI) * 0.32;
  }

  private updateVictoryLight(plan: DioramaMotionPlan, elapsedMs: number): void {
    if (!plan.victorySweep || !this.currentLayout) {
      return;
    }
    const bounds = this.currentLayout.bounds;
    const progress = Math.min(1, elapsedMs / 620);
    this.victoryLight.intensity = 2.8 * Math.sin(Math.PI * progress);
    this.victoryLight.position.set(
      bounds.minX + (bounds.maxX - bounds.minX) * progress,
      bounds.minY + (bounds.maxY - bounds.minY) * (0.25 + progress * 0.5),
      8,
    );
  }

  private scheduleFrame(): void {
    if (this.presentationTimeMs !== null || this.animationFrame !== null || this.disposed) {
      return;
    }
    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = null;
      this.advanceFrame();
    });
  }

  private finishActiveMotion(): void {
    if (!this.activeMotion) {
      return;
    }
    const motion = this.activeMotion;
    this.activeMotion = null;
    this.motionPositions.clear();
    motion.resolve();
  }

  private render(): void {
    if (this.disposed || this.contextLost) {
      return;
    }
    this.scene.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }
}

export const createDioramaRenderer: DioramaRendererFactory = (canvas, options) =>
  new DioramaRenderer(canvas, options);
