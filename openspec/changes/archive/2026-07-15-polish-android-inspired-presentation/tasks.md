## 1. Visual foundation

- [x] 1.1 Replace the dark workbench tokens with the original cool-gray, porcelain, chrome, jewel, and accent token system.
- [x] 1.2 Recompose the React layout into a portrait-first mobile game flow with a focused desktop canvas.
- [x] 1.3 Preserve existing command wiring, aria labels, test IDs, and fixture behavior while changing visual structure.

## 2. Tactile puzzle components

- [x] 2.1 Refine board frame, target cells, faceted movable gems, and muted locked gems using CSS/SVG primitives.
- [x] 2.2 Refine compact HUD, Shelf recesses, slot states, and actionable controls for touch and keyboard use.
- [x] 2.3 Replace generic overlay/control styling with original victory and status feedback aligned to the material system.

## 3. Interaction and accessibility

- [x] 3.1 Add reducer-derived selected, placement, rejection, Shelf-compaction, and victory feedback classes without visual state mutating rules.
- [x] 3.2 Add short composited transitions and complete `prefers-reduced-motion` behavior.
- [x] 3.3 Verify keyboard focus, accessible names, localized feedback, and narrow/wide responsive layout.

## 4. Verification

- [x] 4.1 Update or add browser E2E coverage for the retained winning flow and reset behavior.
- [x] 4.2 Capture desktop and mobile browser smoke screenshots and review visual hierarchy against the Android-inspired acceptance criteria.
- [x] 4.3 Run typecheck, Bun tests, C++ tests, static build, browser E2E, and strict OpenSpec validation.
