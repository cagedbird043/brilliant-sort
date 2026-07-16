## Context

The approved production view is a wordless pixel cavern with a dense six-by-six board and one visually split twelve-slot Shelf. The rule core is a headless C++20 `BrilliantSortCore` compiled to WebAssembly; TypeScript remains a differential oracle, and the browser renders `GameCorePort` snapshots and transitions. `LevelSpec v1` already stores version, dimensions, Shelf capacity, and an explicit list of target-color/gem-color cells in JSON, but the App statically imports one fixture and the four-color vocabulary is compiled into both languages.

The requested flagship replaces the demonstration board with one large Tux Linux penguin mosaic. The reference image informs density and silhouette only: every active pixel must remain a real target socket plus an independently colored gem, because color matching, locking, connected selection, Shelf storage, and color conservation remain the game.

The current placement animation has three competing visual owners: state updates render the destination gem immediately, a separate React ghost fades toward it after two animation frames, and landing/Shelf FLIP animations can also transform the destination. Its shared 180ms timer starts before the ghost transition begins, so a flight can show duplicate imagery, appear at an anomalous intermediate position, or disappear before settling.

## Goals / Non-Goals

**Goals:**

- Deliver one large, recognizable Tux mosaic on an exact `24×32` authoring canvas with 450–550 active sockets.
- Keep target sockets and gems distinct, conserve every configured color, and prove one deterministic winning trace across TypeScript, native C++, and WASM.
- Preserve the canonical LevelSpec v1/core ABI while making a large art-shaped level practical to author and review.
- Expand the palette with `obsidian`, `pearl`, and `amber` using the existing semantic asset pipeline.
- Use a configured sixteen-slot compact Shelf, rendered as two ordered eight-slot banks.
- Make landscape, square, and portrait stages choose a centered composition from measured fit rather than a single viewport breakpoint.
- Eliminate duplicate/trailing flight artifacts and make animation completion own input-unlock timing.
- Retain wordless presentation, accessible semantics, reduced motion, and the approved cavern.

**Non-Goals:**

- Multiple levels, runtime random generation, procedural Tux art, rewards, progression, timers, loss states, or commercial UI.
- Replacing target sockets with colored picture tiles or turning the puzzle into free-form painting.
- Changing eight-neighbor selection, immutable matching gems, connectivity-safe partial extraction, target batch placement, or victory conditions.
- Adding audio implementation here; this change only preserves presentation-level transition facts for the sibling audio proposal.

## Decisions

### 1. Author a compact map and compile to LevelSpec v1

A new map source stores a palette dictionary plus equal-sized `targets` and `gems` arrays of fixed-width strings. `.` is an inactive coordinate; other symbols resolve through the palette. The source is the reviewable Tux artwork and initial permutation, while a deterministic Bun compiler emits the verbose `LevelSpec v1` consumed by TypeScript and C++.

The compiler assigns stable coordinate-derived gem IDs and rejects unequal dimensions, different active masks, unknown symbols, duplicate identities, target/gem color-count mismatches, invalid Shelf capacity, wrong active-count bounds, or an initial state outside the configured locked/movable ratio. Generated output is committed so browser/native/WASM builds consume identical bytes; the source map is never parsed independently by the two cores.

Alternative considered: add map strings directly to the C++ JSON protocol. Rejected because it would duplicate expansion logic across TypeScript and C++, enlarge the parity surface, and replace a stable runtime ABI for an authoring convenience.

### 2. Build one reference-class Tux level

`tux-01` uses exactly 24 columns and 32 rows, between 450 and 550 active sockets, Shelf capacity 16, and the palette subset required by the final artwork. Between 70% and 80% of active cells begin matched/locked; mismatches are a deterministic permutation designed as movable components rather than random noise.

The target map carries the final Tux silhouette. The initial gem map has exactly the same active mask and color multiset, so every visible wrong gem has a real matching destination. A committed `tux-01.win.json` trace proves the authored component topology and Shelf pressure are solvable without special-case core behavior.

Alternative considered: cap the level near 16×20 for mobile hit size. Rejected because it undercuts the requested flagship density; portrait interaction is solved by camera/layout behavior instead of shrinking the product goal.

### 3. Extend colors end to end, derive art through pixel-bloom

`obsidian`, `pearl`, and `amber` join the TypeScript/C++ color protocol and canonical JSON vocabulary. Board Micro assets are derived/promoted as a dedicated geometry family with crisp one-pixel structure at dense sizes; Shelf banks retain larger variants. Target rims remain code-colored and visible under mismatched gems.

Locked matching gems sit flush at full image-forming clarity. Movable mismatches are slightly raised and expose the target rim; selection lifts them one additional visual step. The final Tux therefore reads as an image without hiding which cells can move.

Alternative considered: uniformly scale the current sprites. Rejected because their transparent margins, facet count, and frame detail become noisy at the expected portrait cell scale.

### 4. Treat Shelf as one sequence with two presentation banks

The core stores one compact sequence of indices `0..15`; append, partial absorption, removal, and compaction never know about banks or orientation. Presentation maps indices `0..7` to Bank A and `8..15` to Bank B. Landscape positions A left and B right; portrait positions A above and B below.

Alternative considered: two independent Shelves. Rejected because it adds route choice and compaction semantics unrelated to the requested visual composition.

### 5. Select layout by measured integer scale

A stage measurement layer observes the dynamic viewport/safe-area rectangle and the board's configured rows/columns. It evaluates a side-bank candidate and a top/bottom-bank candidate, including bank slot size, gaps, and safe padding, then chooses the candidate that yields the larger legal integer board-cell size. Ties prefer side banks on landscape and top/bottom banks on portrait.

The full Tux and both banks are centered on both axes; the page itself does not scroll. When fit-to-stage produces cells below the configured direct-touch threshold, the board remains fully visible by default but enables bounded, integer-step zoom and pan inside the stage. Zoom never changes logical coordinates, DOM order, selection rules, or the Shelf layout.

Alternative considered: a fixed 960px media breakpoint. Rejected because the correct arrangement depends on viewport aspect ratio and each level's board aspect, not width alone.

### 6. Give each moved gem one visual owner

Before dispatch, the view captures source sprite rectangles by stable gem ID. After `GameCorePort` state commits, a layout effect captures destination rectangles and marks moved destinations visually hidden. One portal-layer clone of the actual sprite animates at full opacity from source to destination using WAAPI transform-only motion. When its `Animation.finished` resolves, the clone is removed, the destination is revealed, and an optional short settle runs sequentially.

Shelf survivors use a separate FLIP plan keyed by stable IDs. A gem listed as a source-to-destination flight cannot simultaneously receive survivor FLIP or landing transform. Input unlock waits for `Promise.allSettled` over the authoritative animations, with a bounded fallback timeout for cancellation/navigation; it no longer starts before two `requestAnimationFrame` callbacks.

Reduced-motion mode skips clones and FLIP, reveals final destinations immediately, and keeps the same state/ARIA feedback. Browser tests sample the moving clone and destination visibility to guarantee exactly one visible gem representation, source/end alignment within one CSS pixel, and no page-origin excursion.

Alternative considered: retain React ghost state and adjust opacity/easing. Rejected because it does not remove duplicate ownership or the timer race that causes the reported trail.

### 7. Keep the completed Tux as the terminal reward

On `Won`, the renderer runs one bounded center-out pixel shimmer and leaves the complete Tux visible. It adds no copy, next-level action, replay control, or automatic reset. Accessibility retains an off-screen completion status derived from core state.

## Risks / Trade-offs

- [450–550 active cells increase DOM and layout cost] → Render inactive coordinates as no node, render locked cells without unnecessary handlers/effects, batch measurements in one layout phase, animate transforms only, and set performance budgets in desktop/mobile smoke checks.
- [Dense portrait cells are difficult to target directly] → Preserve full-stage overview, design movable components rather than isolated one-pixel errors, and enable bounded integer zoom/pan below the touch threshold.
- [New palette values can break protocol parity] → Update TypeScript, native C++, WASM, canonical fixtures, and differential traces in one cutover; reject unknown colors before state construction.
- [A generated fixture can drift from its source map] → Commit compiler output and add a check that regeneration is byte-identical.
- [A large authored permutation can be unsolvable] → Require a committed full winning trace and replay it through all three backends before browser acceptance.
- [WAAPI cancellation can strand hidden destinations] → Centralize cleanup in an animation coordinator that always reveals destinations and unlocks input on finish, cancel, unmount, or fallback.
- [Tux silhouette review can cause late map churn] → Keep target and initial maps independent from engine code and treat the final map/asset preview as the human visual approval gate.

## Migration Plan

1. Add the compact map compiler and Tux source while keeping `prism-01` as a test fixture.
2. Extend the color protocol and differential fixtures, then promote reviewed Micro assets.
3. Compile and validate `tux-01`, commit its winning trace, and switch the App fixture only after native/WASM parity passes.
4. Introduce sixteen-slot core semantics before the two-bank renderer.
5. Cut over the measured stage and new animation coordinator behind the Tux fixture.
6. Verify desktop, square, and portrait layouts plus zoom/pan, reduced motion, full replay, and production startup.
7. Roll back by restoring the previous fixture import and renderer commit; no persisted user state or server migration exists.

## Open Questions

No product decisions remain open before implementation. Exact Tux pixel placement, progress ratio within the specified bounds, Micro palette tuning, and motion easing remain visual-review details constrained by this design.
