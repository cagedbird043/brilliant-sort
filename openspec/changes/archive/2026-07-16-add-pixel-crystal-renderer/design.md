## Context

Brilliant Sort already has three pieces of evidence that must now become one production Demo:

```text
TypeScript core      deterministic reducer, versioned LevelSpec, canonicalDump, replay Harness
C++ exercise         stable eight-neighbor FindConnectedMovableGems implementation and native tests
Pixel assets         reviewed gem family, target socket, Shelf tray, and deterministic pixel-bloom pipeline
```

The assessment values a pure core that can be driven by automated Harness, separated from UI/presentation/Cocos, serialised for debugging, and expressed through C++. The current browser still renders generic CSS and invokes the TypeScript reducer directly, so neither the asset pipeline nor the C++ exercise is yet on the production execution path.

This change delivers the complete browser Demo through a headless C++20 game core compiled to WebAssembly, a TypeScript presentation/Harness port, and the approved dark pixel-crystal renderer. WebAssembly is a compiled game-core target, not a replacement for browser UI: React/TypeScript retains DOM, PNG assets, accessibility, input, animation, and static-page integration.

## Goals / Non-Goals

**Goals:**

- Make one complete C++ `BrilliantSortCore` the production authority for all current deterministic rules.
- Reuse the assessment C++ connected-component algorithm in that production core rather than maintaining a parallel exercise-only implementation.
- Define a debuggable JSON v1 ABI that maps directly to the existing LevelSpec, commands, events, rejections, and canonical dumps.
- Build the same C++ source natively for rule tests and to WebAssembly for browser/Bun consumers.
- Prove TS-reference ↔ native-C++ ↔ WASM parity at every fixed command-trace transition before production cutover.
- Keep TypeScript as a thin `GameCorePort` consumer for React, Harness, Agent audit, pixel assets, motion, and accessibility.
- Promote approved pixel assets and perform one coherent dark crystal-repair workbench cutover.
- Automate build, differential diagnostics, replay, browser checks, and CI so human work is limited to visual/product acceptance.

**Non-Goals:**

- A C++ Canvas/WebGL full-stack game, Cocos clone, ECS framework, scene graph, generic engine, or second rendering runtime.
- Duplicate production rule engines, a TypeScript runtime fallback after WASM parity is accepted, binary ABI optimisation, or opaque cross-language memory sharing.
- Changing LevelSpec schema semantics, selection rules, Shelf semantics, victory conditions, fixed fixture behavior, or deferred commercial/power-up scope.
- Calling AI APIs, storing AI credentials, generating runtime assets, adding PixiJS/Cocos, or extending pixel-bloom beyond validation/derivation/preview.

## Decisions

### 1. Build a headless C++ game core, not a C++ UI engine

`BrilliantSortCore` owns the full current deterministic simulation:

```text
LevelSpec loading and validation
Board / BoardCell / Gem / Color / GemId
Selection and eight-neighbor same-color movable components
Locked matching gems and safe extraction policy
Target placement, Shelf placement, twelve-column compaction
Rejections, ordered events, restart, victory, canonical state dump
```

It does not own browser events, DOM, CSS, PNG drawing, layout, animation timing, ARIA, HUD controls, or pixel asset paths. This is the actual future Cocos boundary: a Cocos client can consume the same core protocol without React-specific rule code.

The existing public `FindConnectedMovableGems` assessment function remains available with its documented signature and stable BFS order. Its implementation becomes the production component-selection primitive used by `BrilliantSortCore`; tests cover it both as the interview-facing function and through full command traces. There is no copy-pasted second connected-component algorithm.

### 2. Use a versioned JSON v1 protocol and narrow C ABI

Cross-language communication uses readable JSON because the board is small and debugging/Harness evidence is more valuable than a binary micro-optimisation. JSON v1 reuses current semantic shapes:

```text
input level       LevelSpec JSON
input command     GameCommand JSON
output transition CoreTransition JSON
state evidence    canonicalDump string plus structured GameState
```

`CoreTransition` is canonicalised as:

```json
{
  "schemaVersion": 1,
  "state": { "...": "GameState" },
  "events": [{ "type": "gem-placed", "detail": "gem-1->2:3" }],
  "rejection": null,
  "canonicalDump": "{...stable sorted JSON...}"
}
```

C++ exports a narrow `extern "C"` ABI with opaque session handles and byte-buffer inputs/outputs. The TypeScript adapter owns allocation/copy/free boundaries; JavaScript never observes C++ STL containers, pointers, classes, or mutable core memory directly.

```text
bs_core_create(level_json_bytes, length) -> session_handle
bs_core_dispatch(session_handle, command_json_bytes, length) -> status
bs_core_result_length(session_handle) -> byte_length
bs_core_copy_result(session_handle, output_bytes, capacity) -> copied_length
bs_core_destroy(session_handle)
```

Protocol failures return an actionable JSON error envelope or explicit status and never crash the browser. The v1 protocol is intentionally synchronous: each `dispatch` produces exactly one complete deterministic transition before the next command.

### 3. Build the same C++ source natively and as isolated WebAssembly

CMake defines native core/test targets and an Emscripten target. Native C++ tests exercise rules independently of JavaScript. The WebAssembly target uses Emscripten modular ES-module output with an isolated async factory, a restricted exported-function list, and `web,node` environments so the same artifact can be exercised by browser presentation and Bun/Node differential tests.

Generated `.wasm`/glue output is build output, not hand-authored source or a committed SDK. Local development and CI run the WASM build before Vite consumes it; static GitHub Pages receives the generated artifact through the normal Vite build. The Emscripten SDK/toolchain remains local or CI-provisioned and is never committed.

### 4. Make TypeScript a port consumer and keep the reducer only as a test oracle

TypeScript exposes a small asynchronous factory and synchronous loaded-session interface:

```text
GameCoreFactory.load(levelSpec) -> Promise<GameCorePort>
GameCorePort.dispatch(command) -> CoreTransition
GameCorePort.snapshot() -> GameState
GameCorePort.restart() -> CoreTransition
GameCorePort.destroy()
```

`WasmGameCore` maps protocol JSON to existing presentation-friendly TypeScript types. React, replay Harness, Agent audit, and browser tests call `GameCorePort`; they do not call `reduce()` on the production path.

The existing TypeScript reducer is retained only while differential verification exists. It is a reference oracle, never a production fallback: after parity passes, a browser load failure is a visible initialization/build failure, not a silent switch to a different rule engine.

### 5. Differential Harness is the main cross-language quality gate

Every fixed fixture and trace is replayed through three paths:

```text
TypeScript reference reducer
Native C++ BrilliantSortCore
WebAssembly BrilliantSortCore through WasmGameCore
```

At each command index, the Harness compares byte-for-byte canonical dumps, structured events, and rejection codes/details. A failure reports command JSON, backend name, before/after dump, first JSON path mismatch, events, rejection, and fixture metadata.

Mandatory coverage includes the existing winning trace, diagonal eight-neighbor selection, locked-gem rejection, wrong-target rejection, full Shelf rejection, partial safe extraction, Shelf compaction, restart, and win transition. This makes an AI-generated C++ port objectively verifiable instead of plausibly similar.

### 6. Promote and consume the locked pixel asset set

Before rendering, `pixel-bloom inspect` validates every reviewed candidate. The approved files are promoted into `src/assets/pixel/` under stable semantic names:

```text
src/assets/pixel/gem-ice.png
src/assets/pixel/gem-navy.png
src/assets/pixel/gem-coral.png
src/assets/pixel/gem-jade.png
src/assets/pixel/socket-neutral.png
src/assets/pixel/shelf-tray-neutral.png
```

The four gem files are derived from the approved ice master through the committed semantic palette manifest. `socket-neutral` and `shelf-tray-neutral` retain their reviewed source dimensions; CSS uses `image-rendering: pixelated`, preserves aspect ratio, and selects discrete display scale after portrait/desktop review. No runtime import, test, or build path may point into ignored `art/inbox/` or `art/review/`.

The current reviewed asset family is locked as the complete v1 set. No more asset generation belongs to this change unless an asset fails inspection or a real viewport review proves it unreadable.

### 7. Render a layered dark crystal-repair workbench from GameCorePort state

React remains semantic HTML. Board and Shelf controls preserve keyboard behavior, ARIA labels, `data-testid` values, and usable hit areas; pixel imagery is decorative layered content inside them:

```text
Board cell
  target-color underlay (CSS/SVG constrained geometry)
  socket-neutral sprite
  gem shadow
  optional gem sprite

Shelf
  continuous code-rendered rail
  twelve row-major semantic slots
  shelf-tray-neutral sprite per slot
  gem shadow
  optional gem sprite
```

A mismatched movable gem leaves its target color visible beneath it; a matching gem is seated/locked and never styled as selectable. The board workbench, target-color underlay, continuous Shelf rail, and pure icon controls are code-rendered geometry, not stretched AI images.

The presentation moves from porcelain cards to an original dark indigo crystal-repair workbench. Reset and clear-selection controls are pure functional pixel-icon buttons with accessible names. Victory is a compact in-canvas completion plaque with restrained pixel celebration and one real replay icon action; it never invents next-level, reward, currency, power-up, lock, payment, or commercial progression UI.

### 8. Derive tactile motion from C++ transitions without changing state

The renderer indexes gem locations by stable gem IDs before and after every `GameCorePort.dispatch`. It creates a presentation-only `GemMotionPlan`:

```text
selection          lift sprites and detach pixel shadows
placement          temporary source-to-destination sprite ghost
landing            socket/tray compression and restrained spark
Shelf compaction   stable-ID FLIP shift to new row-major slots
rejection          local target/board feedback without gem movement
```

The C++ transition updates state immediately. React measures pre/post DOM targets through stable gem data attributes, animates only a temporary ghost, and never changes core state for visual purposes. Accepted spatial transitions impose a 180ms no-queue input lock so a new command cannot visually race an old ghost; the lock always releases after completion or a safe fallback.

Reduced motion skips spatial flight/lift/shake/FLIP but shows the correct WASM state immediately with non-spatial feedback. Motion failure or unavailable DOM measurement cannot leave stale ghosts or block play.

### 9. Preserve responsive accessibility and static deployment

Sprite size and interactive button size are separate. Buttons retain at least 44 CSS-pixel targets where layout permits; sprites stay crisp through pixel-aware rendering rather than arbitrary visual stretching. The Shelf remains compact twelve-column row-major at all supported widths, never becomes a carousel, and never causes horizontal overflow at approximately 390 CSS pixels.

The final bundle remains a static GitHub Pages artifact: Vite packages the React app and generated WASM output; no Bun daemon, backend, AI API, runtime asset service, or login is required.

## Risks / Trade-offs

- **[C++ port divergence]** — differential traces are a mandatory gate; no WASM production cutover before exact parity.
- **[JSON parsing/ABI complexity]** — the protocol is intentionally small, versioned, synchronous, and readable; no direct C++ object bindings or binary ABI in v1.
- **[WASM initialization is asynchronous]** — app boot explicitly waits for `GameCoreFactory.load`; there is no hidden TypeScript fallback.
- **[WASM build toolchain is unavailable initially]** — development/CI use a local or CI-provisioned Emscripten SDK; product code stays C++/TypeScript/Bun.
- **[Source sprites differ in native dimensions]** — viewport review chooses discrete display scale; asset regeneration is not used merely to force matching file sizes.
- **[Ghost motion races rendering]** — temporary ghosts cancel/clean up and input locks have safe release paths.
- **[Full scope is broad]** — native C++ rules and parity are completed before visual cutover so failures remain diagnosable by layer.

## Migration Plan

1. Freeze JSON v1 protocol fixtures from current LevelSpec, commands, canonical dumps, events, and rejection behavior.
2. Implement and native-test C++ `BrilliantSortCore`, reusing the connected-component production implementation.
3. Build Emscripten WASM and implement `WasmGameCore`; run native/WASM/TS differential traces until exact parity.
4. Change browser/Harness production consumers to `GameCorePort`; remove direct TypeScript reducer use from production code.
5. Inspect/promote the locked pixel assets, replace the presentation, and add reducer-transition-driven motion.
6. Run protocol, native, WASM, differential, Bun, C++, Vite, Playwright, browser visual, GitHub Pages, and strict OpenSpec verification.
7. Archive this unified change only after human visual/product acceptance.

## Open Questions

None. JSON v1, complete-current-rule C++ scope, and WASM-only production core after differential parity are locked decisions.
