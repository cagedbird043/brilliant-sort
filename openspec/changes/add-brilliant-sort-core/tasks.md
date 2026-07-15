# Tasks: Add Brilliant Sort Deterministic Core

## 0. Web technical foundation

- [ ] 0.1 Scaffold the Bun + TypeScript strict + React + Vite application and package scripts.
- [ ] 0.2 Add static-app entry point, CSS token layer, and a responsive CSS Grid/SVG presentation shell.
- [ ] 0.3 Configure typecheck, Bun core tests, production build, browser E2E, and C++ test scripts.
- [ ] 0.4 Add a CI workflow that produces a static `dist/` artifact without requiring a production Bun service.

## 1. Rule core and fixed content

- [ ] 1.1 Define versioned `LevelSpec`, canonical `GameState`, gem identity, compact Shelf, selection, command, event, and rejection schemas.
- [ ] 1.2 Add fixed pixel-art level JSON fixtures that satisfy active-cell, unique-gem, Shelf-capacity, and per-color conservation validation.
- [ ] 1.3 Implement canonical JSON serialization with stable coordinate, gem, Shelf, and selection ordering.
- [ ] 1.4 Implement LevelSpec validation, including schema version, unique gem identity, per-color counts, and fixture rejection diagnostics.

## 2. Deterministic gameplay reducer

- [ ] 2.1 Implement eight-neighbor same-color movable component discovery shared by board selection and Shelf selection.
- [ ] 2.2 Implement `Candidates(S)` safe boundary extraction and deterministic source priority.
- [ ] 2.3 Implement selection, cancellation, and replacement with structured rejection reasons.
- [ ] 2.4 Implement batch placement into a matching empty target component while preserving remaining selection connectivity.
- [ ] 2.5 Implement partial transfer to Shelf, compact row-major removal, and Shelf-origin placement back to board.
- [ ] 2.6 Implement `Playing`/`Won` status and rule invariant checks; do not add loss, timer, random, payment, or deferred power-up behavior.

## 3. Harness and regression fixtures

- [ ] 3.1 Implement `scenario.load`, `state.dump`, `command.apply`, `trace.replay`, `snapshot.diff`, and focused `test.run` interfaces.
- [ ] 3.2 Add a component-selection fixture covering diagonal reachability, locked barriers, other-color barriers, empty starts, and stable order.
- [ ] 3.3 Add a Shelf fixture covering partial absorption, full-Shelf rejection, row-major compaction, selection replacement, and cancellation.
- [ ] 3.4 Add a complete fixed-level winning command log and assert `Won`, empty Shelf, and full board matching.
- [ ] 3.5 Add canonical replay determinism regression coverage for identical fixture plus command log.

## 4. Presentation boundary

- [ ] 4.1 Implement a minimal procedural/vector PresentationAdapter that renders the fixed fixture and dispatches commands only.
- [ ] 4.2 Verify every UI interaction and Harness replay reach identical canonical reducer state.
- [ ] 4.3 Keep animation, hit testing, screen scaling, and engine bindings outside the reducer.

## 5. C++ connected-gem exercise

- [ ] 5.1 Implement `FindConnectedMovableGems` with start validation, eight-neighbor traversal, no duplicates, and stable BFS order.
- [ ] 5.2 Add independent C++ tests for valid diagonal component, locked/empty/out-of-bounds starts, and color/movable barriers.
- [ ] 5.3 Document complexity and the additional inputs/rules required to turn traversal into placement priority.

## 6. AI-agent validation loop

- [ ] 6.1 Expose constrained fixture, dump, command, trace, diff, and focused-test entry points to the agent tool layer.
- [ ] 6.2 Persist a structured audit record for every agent-visible patch and validation run.
- [ ] 6.3 Stop on unspecified-rule conflicts and require human clarification rather than adding behavior.
