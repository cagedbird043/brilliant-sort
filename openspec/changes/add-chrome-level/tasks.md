## 1. Chrome Level Data

- [x] 1.1 Transcribe the approved 32×32 four-color Chrome target into `chrome-01.map.json` with exactly 562 active cells and transparent ring/seams.
- [x] 1.2 Author a color-conserving deterministic initial gem map with a 70%–80% matched ratio and compile canonical `chrome-01.json`.
- [x] 1.3 Commit an accepted board/Shelf/finish trace for Chrome and export the level and trace through fixtures and named Harness scenarios.
- [x] 1.4 Add Chrome compile/check scripts and make local hooks validate drift for both production maps.

## 2. Fixed Two-Level Presentation

- [x] 2.1 Add a project-owned pixel next-level control asset matching the existing contextual replay control.
- [x] 2.2 Replace the hard-coded Tux core load with a presentation-owned Tux→Chrome sequence and deterministic core disposal/recreation.
- [x] 2.3 Reset camera, finale, transient motion/feedback, and audio transport on level advance while preserving onboarding dismissal and mute preference.
- [x] 2.4 Make board labels, stage identifiers, and settled-Won next/replay controls reflect the active level without adding persistent navigation UI.

## 3. Contract Coverage

- [x] 3.1 Cover Chrome map geometry, palette, matched ratio, drift, and canonical compilation in Bun tests.
- [x] 3.2 Replay the Chrome trace through TypeScript, native C++, and WASM and assert exact transition parity and final victory invariants.
- [x] 3.3 Cover the ordered restart audio cue and active-level responsive layout invariants.
- [x] 3.4 Add desktop and 390px Playwright contracts for Tux→Chrome navigation, Chrome victory/replay, accessibility, no document reload, and bounded layout.
- [x] 3.5 Capture and approve Chrome solved-state desktop/mobile visual baselines using the existing gem renderer.

## 4. Verification

- [x] 4.1 Run strict OpenSpec validation, TypeScript checks, focused Bun tests, map drift checks, native/WASM builds, and production build.
- [x] 4.2 Run the complete desktop/mobile Playwright suite and manually verify both public levels remain wordless, playable, and visually coherent.

## 5. Previous-Level Navigation

- [x] 5.1 Reuse the deterministic level-switch reset path for Chrome→Tux and restore canonical Tux state without page navigation.
- [x] 5.2 Add a mirrored upper-left previous-level control on Chrome without colliding with the existing audio control.
- [x] 5.3 Verify same-document backward navigation, canonical reset, audio sequencing, and desktop/mobile control spacing.
