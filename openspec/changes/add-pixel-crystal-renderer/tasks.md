## 1. C++ core protocol and native rules

- [ ] 1.1 Freeze JSON v1 fixture/command/transition/canonical-dump protocol examples from the existing deterministic core.
- [ ] 1.2 Implement complete C++20 `BrilliantSortCore` and make the existing connected-component algorithm its production selection primitive.
- [ ] 1.3 Add native C++ tests for complete rules, assessment function compatibility, canonical state output, events, rejections, Shelf compaction, restart, and win.

## 2. WebAssembly port and differential Harness

- [ ] 2.1 Add CMake native and Emscripten targets with isolated ES-module WebAssembly output and restricted C ABI exports.
- [ ] 2.2 Implement TypeScript `GameCorePort` / `WasmGameCore`, migrate production App/Harness consumers behind the port, and keep TypeScript reducer logic test-only.
- [ ] 2.3 Add TS-reference ↔ native-C++ ↔ WASM differential replay diagnostics for all fixed traces and critical failure paths.
- [ ] 2.4 Add local/CI commands that build WASM before browser/Vite verification and fail closed on protocol parity errors.

## 3. Approved assets and pixel presentation

- [ ] 3.1 Inspect/derive/promote the locked gem family, socket, and Shelf tray into `src/assets/pixel/`; preserve ignored candidate inbox boundaries.
- [ ] 3.2 Replace CSS-shaped board/Shelf/gem artwork with layered sprites, code-rendered target/rail geometry, pure icon controls, and replay-only completion plaque.
- [ ] 3.3 Implement GameCorePort-transition-driven lift, ghost flight, landing, local rejection, Shelf FLIP, 180ms input lock, and reduced-motion fallback.
- [ ] 3.4 Preserve twelve-column Shelf semantics, accessibility labels, test IDs, responsive hit targets, and no horizontal overflow.

## 4. Verification and completion

- [ ] 4.1 Add focused protocol, asset, rendering, motion, native, WASM, and differential tests.
- [ ] 4.2 Update Playwright for real assets, WASM boot, gameplay replay, completion, reduced motion, and desktop/mobile visual smoke checks.
- [ ] 4.3 Run pixel-bloom, C++ native, WASM, differential, Bun, Vite, Playwright, GitHub Pages, and strict OpenSpec validation evidence.
- [ ] 4.4 Update README with C++/WASM architecture and archive the unified change after human visual/product approval.
