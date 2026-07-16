## 1. Multi-page foundation

- [x] 1.1 Add exact `three@0.185.1` and `@types/three@0.185.1` dependencies with Bun and keep the lockfile reproducible.
- [ ] 1.2 Add `3d/index.html` and `src/main-3d.tsx` with route-specific document metadata and a boot-safe React root.
- [ ] 1.3 Configure Vite multi-page inputs so root-base and `/brilliant-sort/` builds emit both `index.html` and `3d/index.html` with shared hashed assets.
- [ ] 1.4 Prove in a browser/network smoke that the 2D root remains unchanged and does not request or initialize the Three.js entry chunk.

## 2. Deterministic scene model

- [ ] 2.1 Implement pure Board/Shelf world-layout, stable gem/slot instance maps, target mapping, and responsive orthographic camera-fit calculations under `src/three/`.
- [ ] 2.2 Implement an idempotent `DioramaRenderer` lifecycle with scene, renderer, camera, resize handling, context-loss feedback, presentation clock, diagnostics, and complete disposal.
- [ ] 2.3 Build reusable low-poly socket, gem, Shelf, and cave geometry with fixed palette materials and no stochastic shader inputs.
- [ ] 2.4 Render all 546 Tux cells and configured Shelf slots through stable instanced groups while preserving target, gem, locked, selected, empty, and compact Shelf states.
- [ ] 2.5 Fit desktop and Pixel 5 compositions, cap effective pixel ratio at 2, and hold the stable initial scene at or below 32 draw calls.

## 3. Core session and input

- [ ] 3.1 Implement `ThreeGameApp` core load/destroy, authoritative snapshot state, guarded dispatch, existing audio cue delivery, mute persistence, and boot/error handling.
- [ ] 3.2 Implement immutable `instanceId` target tables, canvas Raycaster picking, and one target-to-`GameCommand` mapping shared by pointer and semantic activation.
- [ ] 3.3 Add semantic Board, Shelf, audio, wand, and replay controls with scene-correlated keyboard focus and locked/disabled behavior.
- [ ] 3.4 Add bounded desktop camera input, mobile-safe touch behavior, rejection feedback, and exact default-camera reset on contextual replay.

## 4. 3D gameplay motion

- [ ] 4.1 Implement deterministic selection lift/focus feedback and accepted placement/compaction motion that finishes on authoritative destination transforms.
- [ ] 4.2 Implement deterministic global-wand waves with fixed gem delays, input locking, and exact won-state handoff.
- [ ] 4.3 Implement the 3D victory light sweep/finale and wand-to-replay transition without duplicating core victory or restart rules.
- [ ] 4.4 Honor reduced motion by completing nonessential movement immediately while preserving global-wand victory, replay, and audio preference behavior.

## 5. Browser proof before publication work

- [ ] 5.1 Build and launch both local routes, then exercise initial load, a ray-picked selection, one complete placement path, global-wand victory, and replay in desktop Chromium.
- [ ] 5.2 Exercise the same critical path at the Pixel 5 viewport and confirm complete Board/Shelf framing, touch picking, no document overflow, and readable scene focus.
- [ ] 5.3 Inspect renderer diagnostics after play and unmount to confirm instance counts, draw-call/pixel-ratio budgets, zero stale motion, one core authority, and disposed resources.
- [ ] 5.4 Present the working desktop and mobile diorama in the browser for initial human visual direction review before expanding regression coverage.

## 6. Regression coverage and publishing

- [ ] 6.1 Add Bun tests for world transforms, camera fit, stable instance identity, target-to-command mapping, and deterministic motion plans.
- [ ] 6.2 Add Playwright desktop and mobile contracts for WebGL boot, actual ray picking, semantic input, accepted placement, global-wand victory, reduced motion, and replay reset.
- [ ] 6.3 Add frozen-camera/time desktop and mobile visual baselines for the initial diorama and one expressive accepted-transition or victory frame.
- [ ] 6.4 Extend CI and public smoke checks to identify both 2D and 3D documents in root-base and `/brilliant-sort/` artifacts before atomic Hong Kong and Pages publication.
- [ ] 6.5 Run typecheck, core/audio/Bun tests, native and WASM builds, complete 2D/3D Playwright projects, fixture drift, production builds, and strict OpenSpec validation.
- [ ] 6.6 Obtain explicit final human visual/product approval on desktop and mobile, publish the commit-aligned artifact through the existing pipeline, verify all four public routes, and keep the change active until that approval is recorded.
