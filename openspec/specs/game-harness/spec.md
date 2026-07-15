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

The Harness SHALL expose `command.apply(command)`. It SHALL call the production reducer and return command input, canonical before state, canonical after state, emitted events, optional rejection, and a field-level diff.

#### Scenario: Applying a rejected target placement

- **GIVEN** a lifted white selection and an empty blue target cell
- **WHEN** the Harness applies `PlaceSelectionAtTarget` to that blue cell
- **THEN** the transition includes rejection code `TargetColorMismatch`
- **AND THEN** before and after state dumps are equal
- **AND THEN** the diff reports no changed state fields.

### Requirement: Replay is deterministic and diagnostic

The Harness SHALL expose `trace.replay(commandLog)` and apply every command through the production reducer in order. On failure it SHALL identify the command index, command payload, before/after dumps, events, rejection, and field-level diff.

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

