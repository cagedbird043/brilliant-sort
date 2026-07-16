## Why

The flagship Tux Demo is fully playable and verifiable, but a reviewer still has to solve the complete puzzle before seeing its terminal image and celebration. The current victory feedback is one restrained shimmer, and the intentionally wordless stage provides no first-visit explanation. The owner has now promoted three explicit product requirements: one in-world global wand that deterministically solves the whole canonical level, a full-board gem-flight finale with an arc-light sweep and pixel fireworks, and one transient sentence of onboarding copy.

This is not a presentation-only shortcut. A one-click win changes canonical board, Shelf, selection, events, status, replay, C++/WASM parity, and Agent/Harness behavior, so it must be implemented as one new core command rather than direct React mutation. The animation remains presentation-owned: stable gem IDs and pre/post rectangles let every actually moved gem fly without changing the atomic core result.

## What Changes

- Add the canonical `apply-global-wand` command to TypeScript, native C++, JSON v1, WASM, Harness, fixtures, differential tests, and browser production.
- Deterministically leave locked matching gems in place, collect every movable Board/Shelf gem by color, pair lexicographically sorted Gem IDs with row-major unmatched same-color targets, clear Shelf and selection, preserve identity/color totals, and finish in `Won`.
- Emit one aggregate `global-wand-applied` event followed by the existing single `won` event; a command issued after `Won` remains rejected by the existing `game-won` contract.
- Add one real in-world magic-wand button with accessible name/state and stable test ID. It remains outside canonical state and dispatches only `apply-global-wand`.
- Derive the global motion plan by comparing stable gem locations before/after dispatch. For `tux-01`, the immutable 410 locked opening bounds the global flight to at most 136 moved gems.
- Animate all moved gems in a deterministic diagonal wave using measured source/destination rectangles, curved transform-only WAAPI keyframes, Large↔Micro LOD handoff, one visible representation, batched DOM insertion, and input lock through all delayed animations.
- Replace the single victory band with one shared manual/global finale: a board arc-light sweep plus three deterministic pixel-firework bursts, then leave the solved Tux visible.
- Add exactly one first-visit sentence: `点击同色宝石，经缓冲槽放回同色空位；也可以点魔法棒一键修复整幅 Tux。` It disappears after the first accepted puzzle/wand command and persists locally.
- Honor reduced motion by committing the global core state immediately, suppressing gem flight and particles, and retaining only concise non-spatial final-state feedback.

## Capabilities

### Modified Capabilities

- `core-gameplay`: Adds the deterministic global-wand command, aggregate event, conservation/locking guarantees, and three-backend parity contract.
- `pixel-crystal-renderer`: Adds full-board wave flight, shared arc-light/firework victory finale, real in-world wand control, cleanup/performance bounds, and reduced-motion behavior.
- `android-inspired-presentation`: Allows one transient first-visit sentence and one functional in-world assist control without reintroducing a dashboard or commercial HUD.

## Impact

Affected areas are core command/event types, TypeScript oracle, C++ command parser/reducer, canonical transitions, WASM parity, Harness traces, gameplay audio cue derivation, App motion orchestration, victory overlay, onboarding persistence, CSS/SVG presentation, accessibility, E2E, README, and OpenSpec documentation. `LevelSpec v1`, gem identities/colors, locked semantics, Shelf ordering, ordinary selection/placement rules, C ABI shape, audio engine ABI, and static deployment remain unchanged.
