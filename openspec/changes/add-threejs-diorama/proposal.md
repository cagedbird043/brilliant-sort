## Why

Brilliant Sort already proves that one deterministic WASM core can drive a polished 2D presentation. A parallel Three.js diorama is an opportunity to validate that renderer boundary, explore a more tactile crystal-board experience, and keep the accepted 2D game untouched while the experiment receives browser and human visual review.

## What Changes

- Add a Three.js presentation at `/3d/` that loads the same fixed Tux level and dispatches the existing `GameCommand` contract through `GameCorePort`.
- Render the Board, Shelf, selection, placement, global wand, victory, and contextual replay as a responsive 3D crystal diorama while preserving the existing wordless interaction model.
- Keep the current 2D site at `/` behaviorally and visually unchanged; the 2D and 3D pages share the WASM core, fixtures, deterministic audio engine, and canonical game semantics.
- Extend the Vite artifact and deployment checks so one immutable build serves both `/` and `/3d/` on GitHub Pages and the existing Hong Kong origin, without a new DNS record or Cloudflare change.
- Add deterministic desktop and mobile browser coverage for 3D picking, gameplay transitions, restart behavior, rendering budgets, and frozen-frame visual regression.
- Treat the 3D page as an experimental presentation branch until it passes automated gates and explicit human visual/product approval.

## Capabilities

### New Capabilities

- `threejs-diorama`: Responsive Three.js rendering, picking, interaction feedback, motion, lifecycle, accessibility, and performance requirements for the 3D game presentation.
- `parallel-3d-publishing`: Build, route, verification, and deployment requirements for serving the existing 2D page at `/` and the 3D page at `/3d/` from one static artifact.

### Modified Capabilities

None. Existing 2D presentation and gameplay requirements remain unchanged.

## Impact

- Adds the pinned `three` package and a dedicated 3D entry point and renderer area under `src/three/`.
- Updates Vite multi-page build configuration, browser tests, visual baselines, and deployment smoke checks.
- Increases the static artifact and browser-test matrix, but does not change the C++ core, WASM ABI, LevelSpec schema, canonical dumps, PixelAudioEngine protocol, or existing production URL.
