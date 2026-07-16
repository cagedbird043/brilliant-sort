## Context

The current React application loads the committed Tux `LevelSpec` through `GameCoreFactory`, treats `GameCorePort` as game authority, derives deterministic audio cues from accepted transitions, and renders the Board and two Shelf banks as DOM pixel sprites. The static artifact is built twice with Vite base `/` and `/brilliant-sort/`, then the same verified commit is published to the Hong Kong symlink release and GitHub Pages.

The 3D experiment must prove that this headless-core boundary supports another renderer without forking gameplay. It also has to coexist with the accepted 2D experience, remain usable on desktop and mobile Chromium, stay within a modest GPU budget for 546 active cells, and produce deterministic browser evidence despite a request-animation-frame presentation loop.

Development begins on `experiment/threejs-diorama`. The OpenSpec change remains active until automated gates pass and the user explicitly accepts the 3D visual/product result.

## Goals / Non-Goals

**Goals:**

- Serve the unchanged 2D application at `/` and an independent Three.js application at `/3d/` from one commit-aligned static artifact.
- Reuse the existing WASM core, fixed Tux fixture, command contract, deterministic audio engine, onboarding/mute persistence, global wand, victory, and contextual replay.
- Present a front-readable, shallow low-poly crystal diorama with responsive bounded camera composition rather than an unrestricted model viewer.
- Keep repeated geometry batched, make pointer picking deterministic, retain semantic keyboard controls, and cleanly dispose WebGL resources.
- Establish browser contracts, rendering budgets, and stable desktop/mobile visual baselines before publication.

**Non-Goals:**

- Changing gameplay rules, the WASM ABI, canonical dumps, level generation, audio protocol, or the existing 2D presentation.
- React Three Fiber, physics engines, GLTF asset pipelines, runtime procedural levels, free-orbit exploration, WebXR, WebGPU, or multiplayer.
- Physically accurate transmission, dynamic shadow maps, stochastic particles, or post-processing stacks in the first vertical slice.
- A new domain, DNS record, Cloudflare API operation, or Cloudflare credential dependency.

## Decisions

### 1. Use native Three.js behind a small imperative renderer boundary

Add exact dependencies `three@0.185.1` and `@types/three@0.185.1`. A React `ThreeGameApp` owns core/audio/UI state, while a non-React `DioramaRenderer` owns `Scene`, `WebGLRenderer`, cameras, meshes, picking, presentation timelines, resize observation, and disposal.

The renderer boundary will expose meaningful operations rather than mirror Three.js calls:

```ts
interface DioramaRenderer {
  renderState(state: GameState): void;
  playTransition(before: GameState, transition: CoreTransition, command: GameCommand): Promise<void>;
  pick(clientX: number, clientY: number): DioramaPick | null;
  focus(target: DioramaTarget | null): void;
  resetCamera(): void;
  snapshotDiagnostics(): DioramaDiagnostics;
  setPresentationTimeForTest(timeMs: number | null): void;
  dispose(): void;
}
```

React creates one renderer per mounted canvas, forwards authoritative states and accepted transitions, and tears it down idempotently under React Strict Mode. Three.js never owns game state.

**Alternatives considered:** React Three Fiber would make JSX composition convenient but adds another reconciler and supporting dependency surface before the scene model is known. A fully non-React 3D page would duplicate audio, persistence, semantic controls, and lifecycle behavior already solved by the application shell. Native Three.js inside one React boundary is the smaller first implementation.

### 2. Preserve the existing 2D App and share only established pure contracts

The 3D entry will load and dispatch through `GameCorePort` directly. Existing pure modules such as `deriveAudioCues`, fixtures, core types, and WASM factory are reused. Small presentation-neutral helpers may be extracted from `App.tsx` only when both renderers need identical behavior, such as transition descriptions or moved-gem identity; the stable 2D motion implementation is not generalized into a speculative renderer framework.

This keeps the initial change boring: two presentation controllers share the authoritative port rather than introducing a universal scene abstraction.

**Alternatives considered:** extracting all current App orchestration into a shared hook would reduce some duplication but couples two very different motion lifecycles and creates a large 2D refactor before any 3D frame is visible.

### 3. Use a fixed front-readable orthographic diorama

World X follows Board columns, world Y follows inverted Board rows, and Z expresses target depth, seated/locked state, selection lift, and motion. The default `OrthographicCamera` looks nearly front-on with a small elevation and azimuth offset so thickness and lighting are visible without breaking the Tux silhouette.

A camera-fit function derives the orthographic frustum from the active Board bounds, Shelf-bank bounds, viewport aspect ratio, and safe padding. Desktop may accept bounded wheel/keyboard zoom and small pointer parallax; mobile uses the fitted composition without unrestricted orbit. Restart restores the fitted camera exactly.

**Alternatives considered:** a perspective camera gives stronger depth but changes apparent cell sizes and complicates mobile picking. OrbitControls makes a good model viewer but lets players hide the Board or misread target adjacency. Orthographic projection preserves puzzle readability.

### 4. Keep draw calls bounded with stable instancing

Repeated objects use fixed-capacity `InstancedMesh` groups:

- one target/socket mesh per gameplay color;
- one gem mesh per gameplay color, with a stable `gemId -> instance index` table across Board and Shelf moves;
- one Shelf-tray mesh for every configured slot;
- a small fixed set of cave frame, floor, and light objects.

A shared beveled low-poly gem geometry and color-specific opaque/emissive materials avoid transparent-sort artifacts. Selection, locked state, rejection, and focus change transforms and instance colors; they do not create per-cell meshes. Matrices and colors are updated in batches with reusable `Matrix4`, `Color`, and vector scratch objects, followed by one `needsUpdate` per changed buffer.

The first stable frame budget is 32 draw calls and device pixel ratio is capped at 2. Real-time shadow maps and transmission are deferred; authored key/fill/rim lights, emissive materials, and inexpensive contact-darkening geometry provide depth.

**Alternatives considered:** 546 independent Mesh objects simplify local state but waste draw calls, allocations, traversal, and ray tests. A custom merged shader could reduce calls further but is unnecessary under the explicit budget.

### 5. Make instance identity and picking explicit

Each pickable `InstancedMesh` owns an immutable array mapping `instanceId` to a typed target:

```ts
type DioramaTarget =
  | { readonly kind: "board"; readonly coord: Coord; readonly gemId: string | null }
  | { readonly kind: "shelf"; readonly index: number; readonly gemId: string | null };
```

The canvas converts pointer coordinates to normalized device coordinates, Raycaster returns the nearest enabled mesh intersection, and the immutable table resolves `instanceId`. React converts that target plus current authoritative selection into the same command choice used by the 2D presentation. Disabled/locked targets remain ray-visible for feedback but cannot dispatch an enabled selection.

A parallel semantic-control layer exposes Board cells, Shelf slots, audio, wand, and replay to keyboard and assistive technology. Focus updates the corresponding instance highlight; activation follows the same target-to-command function as ray picking.

### 6. Drive motion from accepted transitions with a deterministic presentation clock

Before dispatch, the 3D controller captures source transforms. After dispatch, it computes destination transforms from `transition.state` and plans motion only when `transition.rejection` is null. Standard placement, Shelf compaction, global-wand waves, victory, and replay use fixed durations and stable per-gem delays derived from coordinates or IDs; no `Math.random()` enters a visible sequence.

`DioramaRenderer.playTransition` owns one presentation timeline and resolves when all planned transforms reach their authoritative destinations. React locks further gameplay input until resolution. Reduced motion skips nonessential interpolation and renders the final authoritative transforms immediately.

The renderer accepts an optional presentation-time override used by Playwright to freeze a known camera and animation frame. This hook can alter presentation time only; it cannot dispatch commands or mutate core state.

### 7. Build two HTML entries in one Vite graph

Add `3d/index.html` referencing `src/main-3d.tsx`, and configure Vite Rollup inputs for both root `index.html` and `3d/index.html`. A root-base build emits:

```text
dist/index.html
dist/3d/index.html
dist/assets/<shared and entry-specific hashed assets>
```

The existing Pages build with `--base=/brilliant-sort/` makes both HTML files reference `/brilliant-sort/assets/...`; the public 3D document remains `/brilliant-sort/3d/`. The Three.js import exists only in the 3D entry graph, so loading root does not request or initialize it. Shared WASM/audio/fixture chunks may be deduplicated by Vite.

**Alternatives considered:** separate builds require copying and reconciling two manifests and can accidentally publish mixed commits. A client-side route would make direct static refresh and payload isolation harder. Vite multi-page input produces the required paths natively.

### 8. Reuse the existing atomic deployment with route-specific checks

No Cloudflare API call is required. The existing Hong Kong job rsyncs the combined `dist/` into one immutable SHA release and atomically updates `current`; GitHub Pages uploads the same combined Pages artifact. Smoke checks request both public entries and verify route-specific markers, not only HTTP 200.

The experimental branch is for local/browser iteration and does not deploy over the accepted site. After human visual approval, the change is merged to `main`; the normal `verify -> publish-hk -> deploy` sequence publishes both entries together.

### 9. Test renderer contracts and visuals at stable states

Pure Bun tests cover Board/world transforms, camera fit, stable instance maps, target-to-command mapping, and deterministic motion plans. Playwright desktop and Pixel 5 projects cover WebGL boot, semantic and actual ray-picked input, an accepted move, global-wand victory, replay reset, reduced motion, resource cleanup where observable, and the draw-call/pixel-ratio budgets.

The renderer exposes diagnostics containing readiness, authoritative canonical identity, camera parameters, draw calls, instance counts, last pick, active motion count, and disposal state. Frozen-time screenshots use fixed camera/light/material settings and platform-specific baselines. Initial 2D tests continue unchanged, including the current victory-shimmer baselines.

## Risks / Trade-offs

- **[Risk] Software WebGL in CI renders small pixel differences** → Use opaque materials, fixed lights/camera, no stochastic shader inputs, CSS-pixel screenshots, platform-specific baselines, and a narrow documented tolerance.
- **[Risk] The Three.js chunk increases root payload** → Keep separate HTML entry graphs and assert that the 2D root neither requests the 3D chunk nor creates WebGL.
- **[Risk] React Strict Mode double-mount leaks GPU resources or loops** → Make renderer creation effect-scoped and disposal idempotent; assert stopped animation frames and disposed diagnostics.
- **[Risk] Instance compaction breaks picking identity** → Allocate stable per-gem and per-slot instance indices once per loaded level; never infer gameplay identity from current array order.
- **[Risk] Crystal transparency creates sorting and mobile performance problems** → Use opaque/emissive faceted materials in the first slice; consider transmission only after profiling.
- **[Risk] A long-lived experiment branch diverges from core fixes** → Keep all core changes on `main`, regularly merge `main` into the experiment, and merge the renderer back once the vertical slice is approved.
- **[Risk] Canvas interaction loses accessibility** → Keep semantic DOM controls authoritative for keyboard/assistive input and visibly correlate focus in the scene.
- **[Risk] Direct `/3d/` refresh resolves the wrong document** → Emit a physical `dist/3d/index.html` and verify direct navigation on preview, Pages base, and Hong Kong root base.

## Migration Plan

1. Create the OpenSpec artifacts and implement only on `experiment/threejs-diorama`.
2. Add the pinned dependency, multi-page entry, and a resource-safe empty renderer shell without changing the 2D root.
3. Deliver the initial 546-cell Tux diorama, responsive camera, instanced state mapping, semantic controls, and picking.
4. Add accepted transition motion, audio parity, global wand, victory, replay, reduced motion, diagnostics, and browser evidence.
5. Run typecheck, core/audio tests, root 2D E2E, new 3D E2E, both visual projects, production builds, fixture drift, and strict OpenSpec validation.
6. Present desktop and mobile local browser builds for explicit visual/product approval; keep the OpenSpec change active until approval.
7. Merge the approved renderer and multi-page build to `main`. Let the existing workflow publish one commit-aligned artifact, then smoke-test all four public 2D/3D URLs.
8. Roll back by redeploying or reverting the last known-good combined artifact; the Hong Kong symlink and Pages commit remain atomic, and no DNS rollback exists.

## Open Questions

- The exact balance between pixel-stepped faceting and polished crystal highlights will be resolved through browser visual review of the first rendered Tux.
- Small bounded pointer parallax may improve depth on desktop, but it remains optional if it weakens picking or mobile consistency.
- The first victory treatment will reuse the established light sweep and deterministic timing vocabulary; additional 3D camera motion or particles require separate visual approval after the core loop is stable.
