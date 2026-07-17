import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color as ThreeColor,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Group,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Texture } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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
  getDioramaExposedEdgeSegments,
  getDioramaLayoutMode,
  getDioramaShelfRailAnchors,
  type DioramaInstanceIdentity,
  type DioramaViewport,
} from "./layout";
import {
  planDioramaTransition,
  sampleDioramaGemMotion,
  type DioramaMotionPlan,
} from "./motion";

const PALETTE: Record<GameColor, number> = {
  navy: 0x6c7cff,
  ice: 0x65e3ff,
  coral: 0xff6f78,
  jade: 0x54dfa5,
  obsidian: 0x30415f,
  pearl: 0xf4f7ff,
  amber: 0xffb33f,
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
const VOID = 0x030610;
const OBSIDIAN_SLAB = 0x050a16;
const OBSIDIAN_FRAME = 0x15223b;
const EXPOSED_EDGE = 0x6f8bb8;
const MAX_PIXEL_RATIO = 2;
const REJECTION_DURATION_MS = 260;
const GEM_SCALE = 0.86;
const LOCKED_GEM_SCALE = 0.81;
const SELECTED_GEM_LIFT = 0.24;
const FOCUS_GEM_LIFT = 0.11;
const HIDDEN_SCALE = 0.00001;
const CAMERA_AZIMUTH = 0.68;
const CAMERA_ELEVATION = 0.86;

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

function darkEnamel(color: number): ThreeColor {
  return new ThreeColor(color).multiplyScalar(0.28);
}

function createChamferedSquareGeometry(size: number, depth: number, bevel: number): BufferGeometry {
  const half = size / 2;
  const clip = half * 0.24;
  const outline = [
    [-half + clip, -half],
    [half - clip, -half],
    [half, -half + clip],
    [half, half - clip],
    [half - clip, half],
    [-half + clip, half],
    [-half, half - clip],
    [-half, -half + clip],
  ] as const;
  const layers = [
    { z: -depth / 2, scale: 0.78 },
    { z: -depth / 2 + bevel, scale: 1 },
    { z: depth / 2 - bevel, scale: 1 },
    { z: depth / 2, scale: 0.84 },
  ] as const;
  const vertices: number[] = [];
  for (const layer of layers) {
    for (const [x, y] of outline) {
      vertices.push(x * layer.scale, y * layer.scale, layer.z);
    }
  }
  const bottomCenter = vertices.length / 3;
  vertices.push(0, 0, -depth / 2);
  const topCenter = vertices.length / 3;
  vertices.push(0, 0, depth / 2);
  const indices: number[] = [];
  for (let layer = 0; layer < layers.length - 1; layer += 1) {
    const from = layer * outline.length;
    const to = (layer + 1) * outline.length;
    for (let index = 0; index < outline.length; index += 1) {
      const next = (index + 1) % outline.length;
      const a = from + index;
      const b = from + next;
      const c = to + next;
      const d = to + index;
      indices.push(a, b, d, b, c, d);
    }
  }
  const firstLayer = 0;
  const lastLayer = (layers.length - 1) * outline.length;
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length;
    indices.push(bottomCenter, firstLayer + next, firstLayer + index);
    indices.push(topCenter, lastLayer + index, lastLayer + next);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createEdgeGeometry(state: GameState): BufferGeometry {
  const segments = getDioramaExposedEdgeSegments(state);
  const positions = new Float32Array(segments.length * 6);
  segments.forEach((segment, index) => {
    const offset = index * 6;
    positions[offset] = segment.from.x;
    positions[offset + 1] = segment.from.y;
    positions[offset + 2] = segment.from.z;
    positions[offset + 3] = segment.to.x;
    positions[offset + 4] = segment.to.y;
    positions[offset + 5] = segment.to.z;
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Imperative native Three.js renderer. Its only mutable game-facing input is
 * a GameState snapshot supplied by the authoritative core; no scene object
 * owns selection, connectivity, placement, or victory rules.
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
  private readonly focusColor = new ThreeColor(0x65e3ff);
  private readonly rejectionColor = new ThreeColor(0xff6f78);
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
  private readonly reliquaryFrame: InstancedMesh;
  private readonly wand: Group;
  private readonly victoryBeam: Mesh;
  private readonly keyLight = new DirectionalLight(0xffd0a5, 1.4);
  private readonly rimLight = new DirectionalLight(0x65e3ff, 1.05);
  private readonly hemisphereLight = new HemisphereLight(0x30415f, 0x050815, 0.58);
  private readonly pmremGenerator: PMREMGenerator;
  private readonly roomEnvironment: RoomEnvironment;
  private readonly environmentTexture: Texture;
  private readonly gemGeometry: BufferGeometry;
  private readonly socketGeometry: BufferGeometry;
  private readonly railGeometry: BufferGeometry;

  private currentState: GameState | null = null;
  private identity: DioramaInstanceIdentity | null = null;
  private signature: string | null = null;
  private layoutMode: DioramaLayoutMode = "landscape";
  private currentLayout: DioramaSceneLayout | null = null;
  private shelfMesh: InstancedMesh | null = null;
  private shelfRailMesh: InstancedMesh | null = null;
  private edgeLines: LineSegments | null = null;
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
  private reducedMotion = false;

  constructor(canvas: HTMLCanvasElement, options: DioramaRendererOptions) {
    this.options = options;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.setClearColor(VOID, 1);
    this.scene.background = new ThreeColor(VOID);

    this.pmremGenerator = new PMREMGenerator(this.renderer);
    this.roomEnvironment = new RoomEnvironment();
    this.environmentTexture = this.pmremGenerator.fromScene(this.roomEnvironment).texture;
    this.scene.environment = this.environmentTexture;

    this.gemGeometry = this.trackGeometry(createChamferedSquareGeometry(0.84, 0.46, 0.09));
    this.socketGeometry = this.trackGeometry(createChamferedSquareGeometry(0.98, 0.14, 0.055));
    this.railGeometry = this.trackGeometry(new BoxGeometry(1, 0.18, 0.12));

    const floorGeometry = this.trackGeometry(new BoxGeometry(1, 1, 0.14));
    const floorMaterial = this.trackMaterial(
      new MeshPhysicalMaterial({
        color: OBSIDIAN_SLAB,
        roughness: 0.82,
        metalness: 0,
        specularIntensity: 0.05,
        clearcoat: 0.02,
        clearcoatRoughness: 0.58,
        envMapIntensity: 0,
        flatShading: true,
      }),
    );
    this.floor = new Mesh(floorGeometry, floorMaterial);
    this.floor.position.z = -0.3;

    const backdropGeometry = this.trackGeometry(new PlaneGeometry(1, 1));
    const backdropMaterial = this.trackMaterial(
      new MeshStandardMaterial({
        color: 0x02040b,
        roughness: 0.98,
        metalness: 0,
        envMapIntensity: 0.12,
      }),
    );
    this.backdrop = new Mesh(backdropGeometry, backdropMaterial);
    this.backdrop.position.z = -0.76;

    const frameMaterial = this.trackMaterial(
      new MeshPhysicalMaterial({
        color: OBSIDIAN_FRAME,
        roughness: 0.48,
        metalness: 0.42,
        clearcoat: 0.38,
        clearcoatRoughness: 0.26,
        envMapIntensity: 0.52,
        flatShading: true,
      }),
    );
    const frameGeometry = this.trackGeometry(new BoxGeometry(1, 1, 0.15));
    this.reliquaryFrame = new InstancedMesh(frameGeometry, frameMaterial, 4);
    this.reliquaryFrame.instanceMatrix.setUsage(DynamicDrawUsage);
    this.reliquaryFrame.frustumCulled = false;

    const wandStemGeometry = this.trackGeometry(new BoxGeometry(0.08, 1.12, 0.08));
    const wandStemMaterial = this.trackMaterial(
      new MeshPhysicalMaterial({
        color: 0xf4f7ff,
        roughness: 0.36,
        metalness: 0.42,
        clearcoat: 0.3,
        clearcoatRoughness: 0.24,
      }),
    );
    const wandStem = new Mesh(wandStemGeometry, wandStemMaterial);
    wandStem.rotation.z = -0.48;
    const wandTipMaterial = this.trackMaterial(
      new MeshPhysicalMaterial({
        color: PALETTE.ice,
        roughness: 0.25,
        metalness: 0.18,
        clearcoat: 0.48,
        clearcoatRoughness: 0.18,
        emissive: new ThreeColor(PALETTE.ice).multiplyScalar(0.035),
        emissiveIntensity: 0.65,
        flatShading: true,
      }),
    );
    const wandTip = new Mesh(this.gemGeometry, wandTipMaterial);
    wandTip.scale.setScalar(0.42);
    wandTip.position.set(0.26, 0.54, 0.08);
    this.wand = new Group();
    this.wand.add(wandStem, wandTip);

    const beamGeometry = this.trackGeometry(new PlaneGeometry(1, 1));
    const beamMaterial = this.trackMaterial(
      new MeshPhysicalMaterial({
        color: 0x9edfff,
        emissive: new ThreeColor(0x65e3ff),
        emissiveIntensity: 1.25,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
        roughness: 0.22,
        metalness: 0,
        side: DoubleSide,
      }),
    );
    this.victoryBeam = new Mesh(beamGeometry, beamMaterial);
    this.victoryBeam.renderOrder = 7;

    this.caveGroup.add(this.backdrop, this.floor, this.reliquaryFrame, this.wand, this.victoryBeam);
    this.scene.add(this.caveGroup);
    this.scene.add(this.hemisphereLight, this.keyLight, this.rimLight);
    this.keyLight.position.set(-8, 11, 18);
    this.rimLight.position.set(8, 3, -10);
    this.camera.position.set(CAMERA_AZIMUTH, CAMERA_ELEVATION, 25);
    this.camera.lookAt(0, 0, 0);

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
    this.currentLayout = createDioramaLayout(state, this.layoutMode);
    if (needsRebuild) {
      this.buildGameplayMeshes(state);
    }
    if (needsRebuild || modeChanged) {
      this.updateStaticLayout();
    }
    this.applyStateTransforms();
    this.sceneReady = true;
    this.render();
  }

  playTransition(before: GameState, transition: CoreTransition, command: GameCommand): Promise<void> {
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
      this.resetVictoryPresentation();
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
      this.resetVictoryPresentation();
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
    this.roomEnvironment.dispose();
    this.environmentTexture.dispose();
    this.pmremGenerator.dispose();
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.renderer.dispose();
  }

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
      this.updateStaticLayout();
    }
    this.applyStateTransforms();
    this.render();
  }

  private buildGameplayMeshes(state: GameState): void {
    if (!this.currentLayout) {
      return;
    }
    for (const color of GAME_COLORS) {
      const cells = this.currentLayout.boardCells.filter(
        (cell) => state.board.cells[keyOf(cell.coord)]?.targetColor === color,
      );
      if (cells.length > 0) {
        const socketMaterial = this.trackMaterial(
          new MeshPhysicalMaterial({
            color: darkEnamel(PALETTE[color]),
            roughness: 0.58,
            metalness: 0.2,
            clearcoat: 0.24,
            clearcoatRoughness: 0.38,
            emissive: darkEnamel(PALETTE[color]).multiplyScalar(0.018),
            emissiveIntensity: 0.55,
            flatShading: true,
          }),
        );
        const socketMesh = new InstancedMesh(this.socketGeometry, socketMaterial, cells.length);
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
          new MeshPhysicalMaterial({
            color: PALETTE[color],
            roughness: 0.3,
            metalness: 0.14,
            clearcoat: 0.46,
            clearcoatRoughness: 0.2,
            emissive: new ThreeColor(PALETTE[color]).multiplyScalar(0.018),
            emissiveIntensity: 0.62,
            flatShading: true,
          }),
        );
        const gemMesh = new InstancedMesh(this.gemGeometry, gemMaterial, gemIds.length);
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

    const shelfMaterial = this.trackMaterial(
      new MeshPhysicalMaterial({
        color: PALETTE.obsidian,
        roughness: 0.5,
        metalness: 0.3,
        clearcoat: 0.3,
        clearcoatRoughness: 0.3,
        flatShading: true,
      }),
    );
    this.shelfMesh = new InstancedMesh(this.socketGeometry, shelfMaterial, this.currentLayout.shelfSlots.length);
    this.shelfMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.shelfMesh.frustumCulled = false;
    const shelfTargets = this.currentLayout.shelfSlots.map((slot) => ({
      kind: "shelf" as const,
      index: slot.index,
    }));
    this.pickTargets.set(this.shelfMesh, shelfTargets);
    this.pickMeshes.push(this.shelfMesh);
    this.scene.add(this.shelfMesh);

    const railMaterial = this.trackMaterial(
      new MeshPhysicalMaterial({
        color: 0x263653,
        roughness: 0.62,
        metalness: 0.28,
        clearcoat: 0.22,
        clearcoatRoughness: 0.38,
        flatShading: true,
      }),
    );
    this.shelfRailMesh = new InstancedMesh(this.railGeometry, railMaterial, 2);
    this.shelfRailMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.shelfRailMesh.frustumCulled = false;
    this.scene.add(this.shelfRailMesh);

    const edgeGeometry = this.trackGeometry(createEdgeGeometry(state));
    const edgeMaterial = this.trackMaterial(
      new LineBasicMaterial({ color: EXPOSED_EDGE, transparent: true, opacity: 0.42 }),
    );
    this.edgeLines = new LineSegments(edgeGeometry, edgeMaterial);
    this.edgeLines.frustumCulled = false;
    this.edgeLines.renderOrder = 5;
    this.scene.add(this.edgeLines);
  }

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
    if (this.shelfRailMesh) {
      this.disposeGameplayMesh(this.shelfRailMesh);
      this.shelfRailMesh = null;
    }
    if (this.edgeLines) {
      this.scene.remove(this.edgeLines);
      if (this.ownedGeometries.delete(this.edgeLines.geometry)) {
        this.edgeLines.geometry.dispose();
      }
      const materials = Array.isArray(this.edgeLines.material) ? this.edgeLines.material : [this.edgeLines.material];
      materials.forEach((material) => {
        if (this.ownedMaterials.delete(material)) {
          material.dispose();
        }
      });
      this.edgeLines = null;
    }
    this.socketGroups.clear();
    this.gemGroups.clear();
    this.gemGroupById.clear();
    this.pickTargets.clear();
    this.pickMeshes.length = 0;
  }

  private disposeGameplayMesh(mesh: InstancedMesh): void {
    this.scene.remove(mesh);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (this.ownedMaterials.delete(material)) {
        material.dispose();
      }
    });
  }

  private updateStaticLayout(): void {
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
        this.setStateColor(group.mesh, index, 1, false, false);
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
        this.setStateColor(this.shelfMesh!, index, 0.9, false, false);
      });
      this.shelfMesh.instanceMatrix.needsUpdate = true;
      if (this.shelfMesh.instanceColor) {
        this.shelfMesh.instanceColor.needsUpdate = true;
      }
      this.shelfMesh.computeBoundingSphere();
    }

    if (this.shelfRailMesh) {
      const rails = getDioramaShelfRailAnchors(this.currentLayout);
      rails.forEach((rail, index) => {
        this.setInstanceTransformXYZ(
          this.shelfRailMesh!,
          index,
          rail.center,
          rail.width,
          1,
          1,
          0,
        );
      });
      this.shelfRailMesh.instanceMatrix.needsUpdate = true;
      this.shelfRailMesh.computeBoundingSphere();
    }

    const bounds = this.currentLayout.bounds;
    const width = bounds.maxX - bounds.minX + 2.6;
    const height = bounds.maxY - bounds.minY + 2.7;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    this.floor.position.set(centerX, centerY, -0.3);
    this.floor.scale.set(width, height, 1);
    this.backdrop.position.set(centerX, centerY, -0.78);
    this.backdrop.scale.set(width, height, 1);

    const frameWidth = bounds.maxX - bounds.minX + 1.15;
    const frameHeight = bounds.maxY - bounds.minY + 1.15;
    this.setInstanceTransformXYZ(
      this.reliquaryFrame,
      0,
      { x: centerX, y: bounds.maxY + 0.56, z: -0.2 },
      frameWidth,
      0.14,
      1,
      0,
    );
    this.setInstanceTransformXYZ(
      this.reliquaryFrame,
      1,
      { x: centerX, y: bounds.minY - 0.56, z: -0.2 },
      frameWidth,
      0.14,
      1,
      0,
    );
    this.setInstanceTransformXYZ(
      this.reliquaryFrame,
      2,
      { x: bounds.minX - 0.56, y: centerY, z: -0.2 },
      0.14,
      frameHeight,
      1,
      0,
    );
    this.setInstanceTransformXYZ(
      this.reliquaryFrame,
      3,
      { x: bounds.maxX + 0.56, y: centerY, z: -0.2 },
      0.14,
      frameHeight,
      1,
      0,
    );
    this.reliquaryFrame.instanceMatrix.needsUpdate = true;
    this.reliquaryFrame.computeBoundingSphere();

    this.wand.position.set(bounds.maxX - 0.8, bounds.maxY + 0.36, 0.24);
    this.applyCameraFit();
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
    this.camera.position.set(centerX + CAMERA_AZIMUTH, centerY + CAMERA_ELEVATION, 25);
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
    this.wand.position.z = 0.24;
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
    for (const group of this.socketGroups.values()) {
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
        this.setInstanceTransform(group.mesh, index, cell.target, (focused ? 1.08 : 1) * pulse, 0);
        this.setStateColor(group.mesh, index, 1, focused, rejecting);
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
      this.setStateColor(this.shelfMesh!, index, 0.9, focused, rejecting);
    });
    this.shelfMesh.instanceMatrix.needsUpdate = true;
    if (this.shelfMesh.instanceColor) {
      this.shelfMesh.instanceColor.needsUpdate = true;
    }
  }

  private applyGemTransforms(overrides?: ReadonlyMap<GemId, WorldPoint>): void {
    if (!this.currentState || !this.currentLayout) {
      return;
    }
    const gemState = this.gemRenderState();
    const rejectingKey = this.rejectedTarget && this.isRejecting() ? dioramaTargetKey(this.rejectedTarget) : null;
    const focusedKey = this.focusedTarget ? dioramaTargetKey(this.focusedTarget) : null;
    for (const group of this.gemGroups.values()) {
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
        const z = point.z + (motionOverride ? 0 : selected ? SELECTED_GEM_LIFT : focused ? FOCUS_GEM_LIFT : locked ? -0.03 : 0);
        const pulse = rejecting ? this.rejectionPulse() : 1;
        const scale = (locked ? LOCKED_GEM_SCALE : GEM_SCALE) * (selected ? 1.05 : 1) * (focused ? 1.04 : 1) * pulse;
        this.setInstanceTransform(group.mesh, index, { x: point.x, y: point.y, z }, scale, 0);
        this.setStateColor(group.mesh, index, 1, selected || focused, rejecting);
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
      for (const cell of Object.values(this.currentState.board.cells)) {
        if (cell.gemId && this.currentState.gems[cell.gemId]?.color === cell.targetColor) {
          lockedGemIds.add(cell.gemId);
        }
      }
    }
    return {
      lockedGemIds,
      selectedGemIds: new Set(this.currentState?.selection?.gemIds ?? []),
    };
  }

  private setInstanceTransform(mesh: InstancedMesh, index: number, point: WorldPoint, scale: number, rotationZ: number): void {
    this.setInstanceTransformXYZ(mesh, index, point, scale, scale, scale, rotationZ);
  }

  private setInstanceTransformXYZ(
    mesh: InstancedMesh,
    index: number,
    point: WorldPoint,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    rotationZ: number,
  ): void {
    this.scratchPosition.set(point.x, point.y, point.z);
    this.scratchScale.set(scaleX, scaleY, scaleZ);
    this.scratchEuler.set(0.12, -0.08, rotationZ);
    this.scratchQuaternion.setFromEuler(this.scratchEuler);
    this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    mesh.setMatrixAt(index, this.scratchMatrix);
  }

  private setStateColor(mesh: InstancedMesh, index: number, intensity: number, focused: boolean, rejecting: boolean): void {
    this.scratchColor.setRGB(intensity, intensity, intensity);
    if (focused) {
      this.scratchColor.lerp(this.focusColor, 0.22);
    }
    if (rejecting) {
      this.scratchColor.setRGB(1.18, 0.52, 0.54);
      this.scratchColor.lerp(this.rejectionColor, 0.22);
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
      this.updateVictoryBeam(motion.plan, elapsedMs);
      if (elapsedMs >= motion.plan.durationMs) {
        this.activeMotion = null;
        this.motionPositions.clear();
        this.resetVictoryPresentation();
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
    this.wand.rotation.z = Math.sin(wave * Math.PI * 3) * 0.16;
    this.wand.position.z = 0.24 + Math.sin(wave * Math.PI) * 0.2;
  }

  private updateVictoryBeam(plan: DioramaMotionPlan, elapsedMs: number): void {
    const material = this.victoryBeam.material as MeshPhysicalMaterial;
    if (!plan.victorySweep || !this.currentLayout) {
      material.opacity = 0;
      return;
    }
    const bounds = this.currentLayout.bounds;
    const progress = Math.min(1, elapsedMs / 620);
    const eased = progress * progress * (3 - 2 * progress);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    material.opacity = 0.23 * Math.sin(Math.PI * progress);
    this.victoryBeam.position.set(
      bounds.minX - width * 0.42 + (width * 1.84) * eased,
      bounds.maxY + 0.46 - (height + 0.92) * eased,
      0.92,
    );
    this.victoryBeam.scale.set(Math.max(width * 0.62, 1.5), Math.max(height * 0.34, 1.1), 1);
    this.victoryBeam.rotation.z = -0.42;
    const centerX = (this.cameraFit.left + this.cameraFit.right) / 2;
    const centerY = (this.cameraFit.top + this.cameraFit.bottom) / 2;
    const breath = Math.sin(Math.PI * progress);
    this.camera.position.set(
      centerX + CAMERA_AZIMUTH + breath * 0.038,
      centerY + CAMERA_ELEVATION + breath * 0.024,
      25,
    );
    this.camera.lookAt(centerX + breath * 0.012, centerY + breath * 0.008, 0);
    this.camera.updateMatrixWorld();
  }

  private resetVictoryPresentation(): void {
    (this.victoryBeam.material as MeshPhysicalMaterial).opacity = 0;
    this.victoryBeam.rotation.z = 0;
    if (this.currentLayout) {
      this.applyCameraFit();
    }
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
      this.resetVictoryPresentation();
      return;
    }
    const motion = this.activeMotion;
    this.activeMotion = null;
    this.motionPositions.clear();
    this.resetVictoryPresentation();
    motion.resolve();
  }

  private render(): void {
    if (this.disposed || this.contextLost) {
      return;
    }
    this.scene.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
  }
}

export const createDioramaRenderer: DioramaRendererFactory = (canvas, options) =>
  new DioramaRenderer(canvas, options);
