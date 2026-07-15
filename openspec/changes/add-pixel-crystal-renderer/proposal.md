## Why

Brilliant Sort now has a deterministic `pixel-bloom` pipeline, a reviewed four-color gem family, a reviewed deep-crystal target socket, and a reviewed shallow Shelf tray. The playable game still renders its board, Shelf, gems, and feedback through generic CSS gradients, soft porcelain cards, and container-level nudges. That leaves the actual game visually disconnected from the approved pixel-art material system.

The next change must perform one coherent presentation cutover: promote reviewed assets out of the ignored candidate inbox, replace CSS-fabricated gems with real pixel sprites, build the target/Shelf composition around the new structural assets, and make actual reducer transitions feel tactile at the gem level. This is not a cosmetic shadow tweak; it is the game-facing consumer of the completed asset pipeline.

## What Changes

- Promote approved pixel assets into a versioned game-consumed asset location after `pixel-bloom inspect` review.
- Replace the CSS gradient gem body/facets with `ice`, `navy`, `coral`, and `jade` PNG sprites while retaining semantic buttons and existing accessibility labels.
- Replace board-cell porcelain/color-block presentation with deep-crystal target sockets plus a precise target-color layer.
- Replace generic Shelf slots with the reviewed shallow pixel tray and a continuous, code-rendered Shelf rail.
- Introduce a view-local gem motion layer that derives motion intent from pre/post reducer state without changing game rules, LevelSpec, or reducer outcomes.
- Implement selected lift/shadow separation, placement flight/landing, rejection feedback, and Shelf compaction as pixel-aware motion with a reduced-motion path.
- Replace the remaining generic dashboard/porcelain framing around the interactive board with an original dark crystal-repair workbench presentation.
- Add behavioral, asset, responsive, and visual smoke coverage for the new renderer.

## Capabilities

### New Capabilities

- `pixel-crystal-renderer`: Pixel-art game presentation that consumes approved sprite assets and renders board/Shelf state, target colors, and reducer-driven tactile motion.

### Modified Capabilities

- `android-inspired-presentation`: The presentation moves from a generic light Android-inspired card composition to an original dark pixel-crystal material system while preserving its portrait-first, accessible gameplay affordances.

## Impact

Affected areas are `src/app/App.tsx`, `src/styles.css`, new view-layer components/helpers, approved runtime assets, end-to-end tests, and README/OpenSpec material documentation. The deterministic core, LevelSpec, reducer behavior, Harness, agent audit, C++ exercise, GitHub Pages deployment mechanism, and deferred commercial/power-up features remain unchanged.
