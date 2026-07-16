## Why

The current six-by-six board demonstrates the rules but cannot deliver the dense picture-repair fantasy established by the approved pixel cavern. Its portrait layout also pins a short board-and-Shelf stack to the top of the viewport, while the current ghost-plus-landing motion can show duplicate trails and terminate before a flight settles.

## What Changes

- Replace the demonstration board with one flagship, irregular Tux Linux penguin mosaic at reference-class scale: approximately `24×32`, with roughly 450–550 active target sockets and void cells exposing the cavern.
- Keep the color-match loop explicit: every active Tux pixel remains a target-colored socket containing one independently colored gem; matching gems lock, mismatches remain movable, and target/gem color multisets remain conserved.
- Add `obsidian`, `pearl`, and `amber` to the shared TypeScript/C++/WASM color protocol for Tux body, belly, beak, and feet, while retaining selected existing cool/warm facet colors.
- Add a compact, human-reviewable Tux map source with separate target and initial-gem rows, plus a deterministic Bun compiler that emits the existing `LevelSpec v1` cell list and rejects mask, palette, identity, or color-conservation errors.
- Commit and differentially replay a complete Tux winning trace through the TypeScript oracle, native C++, and WebAssembly core.
- **BREAKING**: change the flagship level Shelf from twelve slots to a configured sixteen-slot compact sequence, rendered as two eight-slot banks without changing append or compaction order.
- Create board-specific Micro socket/gem assets for the dense mosaic while retaining larger Shelf sprites; target-color socket rims remain visible beneath mismatched gems.
- Replace width-only breakpoints with a measured stage layout that compares side-bank and top/bottom-bank candidates, chooses the larger integer cell scale, centers the full stage in the dynamic viewport, and permits bounded board zoom/pan when portrait cells fall below the interaction threshold.
- Preserve the approved wordless cavern: landscape renders Shelf banks left/right of Tux; portrait renders them above/below Tux; no dashboard frame, persistent copy, logo, or reset control returns.
- Replace the overlapping React ghost, landing, and Shelf-FLIP timing with one authoritative FLIP/WAAPI motion plan per moved gem. A moved gem has exactly one visible representation during flight, begins and ends at measured sprite rectangles, and unlocks input only after all animations settle or a safety fallback fires.
- Leave the solved Tux visible after a restrained full-board pixel shimmer; no next-level or replay affordance is added.

## Capabilities

### New Capabilities

- `tux-mosaic-level`: Defines the compact Tux authoring map, deterministic compilation to `LevelSpec v1`, expanded palette, solvability evidence, and one large fixed Tux level.

### Modified Capabilities

- `core-gameplay`: Generalizes the compact Shelf requirement from a fixed twelve-slot baseline to configured capacity and specifies the sixteen-slot Tux sequence while preserving deterministic append, partial extraction, compaction, conservation, and victory rules.
- `pixel-crystal-renderer`: Adds dense Micro socket/gem composition, large irregular-board rendering, one-visible-representation motion, precise flight completion, and the wordless solved-Tux presentation.
- `android-inspired-presentation`: Replaces the obsolete portrait-first vertical flow and old material assumptions with an adaptive cavern stage that uses side banks or top/bottom banks according to measured fit and centers the complete game composition.

## Impact

- Affects `src/fixtures/`, level authoring/validation tooling, TypeScript core types and reducer oracle, C++ JSON/color parsing, WASM protocol parity, App layout/motion, pixel assets, browser interaction, Harness traces, and native/WASM/browser tests.
- Requires new semantic palette variants and promoted Micro sprite assets through `pixel-bloom`; no AI-generated runtime asset or runtime random level generation is introduced.
- Preserves `GameCorePort` authority, eight-neighbor selection, immutable matching gems, connectivity-safe partial moves, compact Shelf semantics, deterministic replay, and victory as matched board plus empty Shelf.
- Publishes presentation-only transition facts that the sibling `add-cpp-pixel-audio-engine` change may map to audio cues; audio state never enters canonical gameplay state.
