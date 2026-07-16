## Why

The production Tux stage can reach `Won`, play its finale, and remain as a solved mosaic, but the player cannot start another run without reloading the browser. The canonical `restart-level` command already restores the initial deterministic state; only the production presentation is missing a safe way to dispatch it.

A persistent reset button during play would add clutter and create accidental-loss risk. Replay should therefore be contextual: keep the current wand during `Playing`, let the completed Tux and finale land, then replace the disabled wand with one real replay control.

## What Changes

- Show one project-owned pixel replay control only after status is `Won`, the victory finale has ended, and authoritative gem motion has settled.
- Reuse the existing right-side in-world control position instead of adding a panel, completion plaque, or permanent reset button.
- Give the replay control an accessible name, keyboard activation, visible focus state, and stable browser-test identifier.
- Dispatch the existing canonical `restart-level` command exactly once. Do not reload the page or mutate React state directly.
- Restore the initial Board, empty Shelf, empty selection, `Playing` status, and default Board camera framing.
- Preserve page-scoped audio state, the persisted mute preference, and the versioned onboarding key across replay.
- Under reduced motion, expose replay immediately after `Won`; no artificial finale delay is introduced.

## Capabilities

### Modified Capabilities

- `android-inspired-presentation`: Adds the accessible contextual replay action and defines its canonical restart, camera, persistence, and reduced-motion behavior.
- `pixel-crystal-renderer`: Allows one post-finale replay control while retaining the wordless cavern and prohibiting persistent reset/dashboard/progression UI.

## Impact

Affected areas are the active presentation specifications, App command wiring, Board camera reset identity, one project-owned SVG icon, control styling, browser E2E, README/submission evidence, and visual review. Core command types, TypeScript/C++ reducers, JSON v1, C ABI, WASM parity, `LevelSpec`, audio ABI, onboarding storage schema, and gameplay rules remain unchanged.
