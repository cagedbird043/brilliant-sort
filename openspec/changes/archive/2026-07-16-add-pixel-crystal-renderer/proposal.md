## Why

Brilliant Sort now has reviewed pixel assets and a deterministic `pixel-bloom` pipeline, but the browser still renders through generic CSS while its production rules execute directly in TypeScript. The assessment values a pure core that can be driven by Harness, decoupled from UI/presentation/Cocos, and expressed through C++; the existing C++ connected-component exercise is currently an isolated proof rather than production code.

This unified Demo change turns the approved assets, complete rules, Harness, and C++ exercise into one evidence chain: a headless C++20 `BrilliantSortCore` runs natively and as WebAssembly, TypeScript becomes the browser presentation/Harness consumer of a versioned JSON protocol, and the React game renders the approved dark pixel-crystal workbench from that core.

## What Changes

- Promote the complete current game rules into a deterministic C++20 `BrilliantSortCore`: LevelSpec loading, board, gems, selection, safe extraction, Shelf compaction, placement, rejections, restart, events, victory, and canonical dumps.
- Reuse the existing C++ eight-neighbor `FindConnectedMovableGems` implementation as the production component-selection algorithm while retaining its assessment-facing contract and native tests.
- Define a language-neutral JSON v1 ABI for loading levels, dispatching commands, reading transitions, events, rejections, and canonical state dumps.
- Build the C++ core through CMake for native tests and through Emscripten into an isolated ES-module WebAssembly artifact; no C++ Canvas/full-stack UI is introduced.
- Add a TypeScript `GameCorePort` and `WasmGameCore` adapter. React, Harness, replay, and Agent audit consume the port; TypeScript reducer code remains only a differential-test oracle until clean production cutover.
- Add TS-reference ↔ native-C++ ↔ WASM differential replay tests over every fixed trace and key rejection/Shelf path.
- Promote approved pixel assets after `pixel-bloom inspect`, then replace CSS-fabricated board/Shelf/gems with project-owned PNG sprites, code-rendered target/rail geometry, pure icon controls, a compact replay-only completion plaque, and reducer-derived tactile motion.
- Preserve the deterministic rules, compact twelve-column Shelf, accessibility, reduced-motion behavior, static GitHub Pages deployment, and deferred commercial/power-up scope.

## Capabilities

### New Capabilities

- `wasm-game-core`: Complete C++ deterministic Brilliant Sort core with native and WebAssembly targets, JSON v1 ABI, TypeScript port adapter, and differential Harness verification.
- `pixel-crystal-renderer`: Original dark pixel-crystal game presentation consuming approved sprites and `GameCorePort` transitions.

### Modified Capabilities

- `core-gameplay`: Browser production execution moves behind a language-neutral core port while preserving current rules and canonical observable behavior.
- `game-harness`: Replay and audit flows gain native/WASM differential diagnostics while retaining fixed-trace contracts.
- `android-inspired-presentation`: The presentation moves from generic light cards to an original dark pixel-crystal workbench while preserving portrait-first, accessible gameplay affordances.

## Impact

Affected areas are `cpp/`, CMake/Emscripten configuration, generated WASM build artifacts, TypeScript core-port/adapter modules, App/Harness command boundaries, `src/assets/pixel/`, view components/styles, differential tests, CI, README, and OpenSpec material documentation. The JSON LevelSpec schema, game rules, pixel-asset pipeline, React ownership of browser UI, GitHub Pages deployment model, and deferred commercial features remain unchanged.
