## Why

The first playable slice proves the rule core, but its dark engineering-workbench presentation is materially distant from the observed Android game: it does not yet communicate a calm, tactile, portrait-first jewel puzzle at first glance. The core is now archived and deterministic, so presentation can be refined without risking gameplay behavior.

## What Changes

- Replace the dark desktop-first surface with an original, Android-inspired, portrait-first puzzle presentation built from CSS/SVG primitives rather than copied assets.
- Introduce a coherent material system for porcelain board frames, glossy faceted gems, muted locked gems, inset Shelf slots, coin/settings controls, and success feedback.
- Recompose desktop around the mobile game canvas while preserving an intentional mobile layout rather than squeezing desktop modules onto a narrow screen.
- Add constrained interaction feedback for selection, invalid actions, placement, Shelf compaction, and victory; honor reduced-motion preferences.
- Preserve the existing React-to-reducer command boundary, fixture behavior, accessible labels, and Harness/E2E contracts.

## Capabilities

### New Capabilities

- `android-inspired-presentation`: Original tactile mobile-puzzle visual system, responsive composition, interaction feedback, and accessibility behavior for the web presentation.

### Modified Capabilities

- None.

## Impact

Affected areas are `src/app/`, `src/styles.css`, browser E2E visual/interaction coverage, and presentation-facing fixture metadata if needed. The pure core, fixed LevelSpec format, Harness, C++ exercise, no-loss rules, and deployment architecture remain unchanged; no new runtime service or dependency is required.
