# game-harness Specification

## Purpose
TBD - created by archiving change add-brilliant-sort-core. Update Purpose after archive.
## Requirements
### Requirement: Harness loads named or inline fixed scenarios

The Harness SHALL load a named fixed LevelSpec fixture or an inline JSON fixture. Loading SHALL validate the fixture before producing a playable state and SHALL report schema and conservation failures structurally.

#### Scenario: Loading a named scenario

- **GIVEN** a registered valid fixture named `penguin-01`
- **WHEN** `scenario.load("penguin-01")` is called
- **THEN** the Harness exposes the fixture's canonical initial state
- **AND THEN** the state is identical to a direct LevelSpec load.

#### Scenario: Loading an invalid inline fixture

- **GIVEN** inline JSON with duplicate gem identity
- **WHEN** `scenario.load(json)` is called
- **THEN** loading fails with a duplicate-gem diagnostic
- **AND THEN** no mutable scenario state is retained.

### Requirement: State dumps are canonical and comparable

The Harness SHALL expose `state.dump()` as canonical JSON. A dump SHALL include board targets and occupancy, gem IDs and colors, compact Shelf sequence, selection, status, schema version, and level identity. It SHALL exclude animation frames, pixel positions, and object addresses.

#### Scenario: Equivalent state dumps compare equal

- **GIVEN** two states reached by replaying the same fixture and command log
- **WHEN** each state is dumped
- **THEN** their serialized canonical JSON is byte-equivalent.

### Requirement: Command application returns a complete transition trace

The Harness SHALL expose `command.apply(command)` through a selected `GameCorePort`. A transition SHALL include command input, canonical before/after state, emitted events, nullable rejection, and field-level diff. Differential mode SHALL run the same command through TypeScript reference, native C++, and WebAssembly C++ backends before accepting a transition.

#### Scenario: Applying a rejected target placement

- **GIVEN** a lifted selection and an empty wrong-color target in a fixed scenario
- **WHEN** differential Harness mode applies the placement command
- **THEN** TypeScript reference, native C++, and WebAssembly all return the same rejection code/detail and byte-equivalent before/after dumps
- **AND THEN** the report identifies every backend and the command index if any result differs.

### Requirement: Replay is deterministic and diagnostic

The Harness SHALL expose replay for a selected production core port and a differential replay mode. Differential replay SHALL compare byte-equivalent canonical dumps, ordered events, and rejection code/details at every command index across TypeScript reference, native C++, and WebAssembly C++.

#### Scenario: Replaying a winning log

- **GIVEN** a fixed level and its committed winning command log
- **WHEN** `trace.replay(commandLog)` runs
- **THEN** replay ends with status `Won`
- **AND THEN** Shelf is empty
- **AND THEN** every active board cell is locked.

#### Scenario: Replay identifies the first divergence

- **GIVEN** an expected checkpoint sequence and a replay whose third command produces a different state
- **WHEN** replay validation runs
- **THEN** the Harness reports command index `2`
- **AND THEN** it includes expected and actual dumps plus a field-level diff.

#### Scenario: Replay identifies the first cross-language divergence

- **GIVEN** a fixed scenario and command log where any backend diverges at one transition
- **WHEN** differential replay runs
- **THEN** it reports fixture metadata, command index, command JSON, backend, before/after dumps, first JSON-path mismatch, events, and rejection difference
- **AND THEN** verification fails before browser production cutover.

### Requirement: Snapshot diffs identify semantic field changes

The Harness SHALL expose `snapshot.diff(expected, actual)`. The result SHALL compare semantic state fields rather than source text or visual snapshots and SHALL identify changed paths, expected value, and actual value.

#### Scenario: Shelf compaction diff

- **GIVEN** expected Shelf sequence `[A, C, D]`
- **AND GIVEN** actual Shelf sequence `[A, C, null, D]`
- **WHEN** snapshots are diffed
- **THEN** the result identifies Shelf sequence/length divergence
- **AND THEN** it does not attribute the failure to presentation.

### Requirement: Focused acceptance tests cover core contracts

The Harness SHALL expose `test.run(selector)` for focused deterministic tests. The baseline suite SHALL cover component traversal, a complete fixed-level win, Shelf and invalid-operation behavior, and replay determinism.

#### Scenario: Running only component tests

- **GIVEN** the component test selector
- **WHEN** `test.run("component")` executes
- **THEN** it runs diagonal connectivity, locked barrier, color barrier, empty start, and stable-order assertions
- **AND THEN** no unrelated UI or payment test is required.

