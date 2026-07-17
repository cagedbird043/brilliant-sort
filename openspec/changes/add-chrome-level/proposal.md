## Why

A second authored mosaic is more persuasive than a rendering-only variant because it proves Brilliant Sort can carry a recognizable sequence of deterministic levels. A modern Chrome-inspired four-color mosaic also connects the product directly to the Chromium browser used by its Playwright acceptance suite.

## What Changes

- Add `chrome-01`, a hand-authored 32×32 modern Chrome mosaic using only coral, amber, jade, and navy gems; transparent coordinates form the center ring, blade seams, and outer silhouette.
- Compile the human-reviewable Chrome target and initial-gem maps into canonical `LevelSpec v1`, with stable coordinate-derived gem IDs and a committed deterministic winning trace.
- Change production from one hard-coded Tux level to a fixed two-level sequence: `tux-01` first, then `chrome-01`, without a level map, random generation, or persistent progression system.
- After settled Tux victory, preserve the original wand→replay control lifecycle and expose a separate wordless next-level control that loads Chrome without refreshing; while Chrome is active, expose a mirrored upper-left previous-level control; Chrome victory retains the same replay lifecycle.
- Keep the C++/WASM core and gameplay rules unchanged while extending named fixture, differential replay, responsive presentation, accessibility, and browser coverage to Chrome.
- Use only project-owned generated pixel data and existing gem materials at runtime; external Chrome references remain design references and do not become runtime dependencies.

## Capabilities

### New Capabilities
- `chrome-mosaic-level`: Defines the approved Chrome target artwork, canonical fixture and winning trace, fixed second-level sequencing, and end-to-end deterministic acceptance.

### Modified Capabilities
- `tux-mosaic-level`: Changes production from exactly one level with no progression to Tux as the first level in a fixed two-level sequence.
- `android-inspired-presentation`: Makes stage semantics, bidirectional level navigation, and the victory action level-aware while preserving the wordless responsive cavern presentation.
- `pixel-crystal-renderer`: Preserves the approved arc-light/pixel-firework finale and contextual replay slot while allowing independent level-navigation controls only outside the finale.

## Impact

- Affected data and tooling: `src/fixtures/source`, generated `src/fixtures` LevelSpec/trace exports, level compile scripts, and named harness scenarios.
- Affected presentation: `src/app/App.tsx`, level-aware labels/control assets, camera reset keys, and current-level core lifetime.
- Affected verification: map drift checks, TypeScript/native/WASM replay parity, audio transition coverage, and desktop/mobile Playwright contracts and snapshots.
- No new runtime dependency, core ABI, gameplay rule, route, level selector, or persistence schema is introduced.
