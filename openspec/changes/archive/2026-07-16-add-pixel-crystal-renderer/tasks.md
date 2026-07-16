## 1. C++ core protocol and native rules

- [x] 1.1 Freeze JSON v1 fixture/command/transition/canonical-dump protocol examples from the existing deterministic core.
- [x] 1.2 Implement complete C++20 `BrilliantSortCore` and make the existing connected-component algorithm its production selection primitive.
- [x] 1.3 Add native C++ tests for complete rules, assessment function compatibility, canonical state output, events, rejections, Shelf compaction, restart, and win.

## 2. WebAssembly port and differential Harness

- [x] 2.1 Add CMake native and Emscripten targets with isolated ES-module WebAssembly output and restricted C ABI exports.
- [x] 2.2 Implement TypeScript `GameCorePort` / `WasmGameCore`, migrate production App/Harness consumers behind the port, and keep TypeScript reducer logic test-only.
- [x] 2.3 Add TS-reference ↔ native-C++ ↔ WASM differential replay diagnostics for all fixed traces and critical failure paths.
- [x] 2.4 Add local/CI commands that build WASM before browser/Vite verification and fail closed on protocol parity errors.

## 3. Approved assets and pixel presentation

- [x] 3.1 Inspect/derive/promote the locked gem family, socket, and Shelf tray into `src/assets/pixel/`; preserve ignored candidate inbox boundaries.
- [x] 3.2 Replace CSS-shaped board/Shelf/gem artwork with layered sprites, code-rendered target/rail geometry, pure icon controls, and replay-only completion plaque.
- [x] 3.3 Implement GameCorePort-transition-driven lift, ghost flight, landing, local rejection, Shelf FLIP, 180ms input lock, and reduced-motion fallback.
- [x] 3.4 Preserve twelve-column Shelf semantics, accessibility labels, test IDs, responsive hit targets, and no horizontal overflow.

## 4. Verification and completion

- [x] 4.1 Add focused protocol, asset, rendering, motion, native, WASM, and differential tests.
- [x] 4.2 Update Playwright for real assets, WASM boot, gameplay replay, completion, reduced motion, and desktop/mobile visual smoke checks.
- [x] 4.3 Run pixel-bloom, C++ native, WASM, differential, Bun, Vite, Playwright, GitHub Pages, and strict OpenSpec validation evidence.
- [x] 4.4 Update README with C++/WASM architecture.
- [x] 4.5 Archive the unified change after human visual/product approval.
