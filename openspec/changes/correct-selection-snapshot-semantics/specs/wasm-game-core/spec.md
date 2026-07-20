## MODIFIED Requirements

### Requirement: The project SHALL provide one complete headless C++ game core

The project SHALL implement the complete current Brilliant Sort rule set in a C++20 `BrilliantSortCore`. It SHALL own LevelSpec loading, board state, gems, latched Selection snapshots, eight-neighbor movable components at selection creation, deterministic frontier extraction, target placement, Shelf placement/compaction, rejection, restart, ordered events, victory, and canonical state dumps.

The C++ core SHALL not own browser DOM, React, CSS, PNG assets, browser input, animation timing, or visual layout.

#### Scenario: Executing a complete winning trace natively

- **WHEN** native C++ `BrilliantSortCore` loads a fixed LevelSpec and receives the committed winning command trace
- **THEN** every command produces the expected deterministic transition
- **AND THEN** the final state is won with all board targets matched and an empty Shelf.

#### Scenario: Rejecting invalid commands

- **WHEN** the native C++ core receives a locked-gem selection, wrong target, occupied target, full Shelf, or no-selection command
- **THEN** it returns the established rejection code/detail without mutating game state
- **AND THEN** it emits no fabricated placement or compaction event.

#### Scenario: Preserving a disconnected Selection remainder

- **GIVEN** a C++ Selection snapshot whose bridge gem has highest extraction priority
- **WHEN** one accepted move removes that bridge gem
- **THEN** the remaining disconnected Gem IDs stay in the Selection snapshot
- **AND THEN** the core does not recompute a connected component over them.

### Requirement: Differential Harness SHALL prove transition parity before production cutover

The Harness SHALL replay each required fixture/trace through the TypeScript reference reducer, native C++ core, and WebAssembly core. It SHALL compare canonical dumps byte-for-byte, ordered events, and rejection code/details at every command index. Required fixtures SHALL include the evidence-backed articulation-point counterexample.

#### Scenario: Detecting a cross-language mismatch

- **WHEN** any backend differs during a replay transition
- **THEN** the differential report identifies the fixture, command index, command JSON, backend, before/after dumps, first JSON-path mismatch, events, and rejection difference
- **AND THEN** the build fails before production cutover.

#### Scenario: Passing all deterministic traces

- **WHEN** every fixed winning, rejection, compaction, partial extraction, articulation-point, and restart trace matches across all three backends
- **THEN** WASM is eligible to remain the only production game-core runtime
- **AND THEN** the TypeScript reducer remains test-only.
