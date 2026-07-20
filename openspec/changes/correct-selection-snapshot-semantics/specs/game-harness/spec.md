## MODIFIED Requirements

### Requirement: Replay is deterministic and diagnostic

The Harness SHALL expose replay for a selected production core port and a differential replay mode. Differential replay SHALL compare byte-equivalent canonical dumps, ordered events, and rejection code/details at every command index across TypeScript reference, native C++, and WebAssembly C++. The committed regression set SHALL include a source-evidence-backed articulation-point trace whose disconnected remainder stays selected.

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

#### Scenario: Replaying an articulation-point extraction

- **GIVEN** a three-gem Selection created from its middle bridge gem
- **AND GIVEN** exactly one destination slot is available
- **WHEN** differential replay extracts one member
- **THEN** every backend moves the middle bridge Gem ID
- **AND THEN** every backend retains the two disconnected endpoint Gem IDs in Selection
- **AND THEN** canonical state, ordered events, and rejection data remain byte-equivalent.

### Requirement: Focused acceptance tests cover core contracts

The Harness SHALL expose `test.run(selector)` for focused deterministic tests. The baseline suite SHALL cover component traversal, a complete fixed-level win, Shelf and invalid-operation behavior, replay determinism, and the articulation-point Selection counterexample.

#### Scenario: Running only component tests

- **GIVEN** the component test selector
- **WHEN** `test.run("component")` executes
- **THEN** it runs diagonal connectivity, locked barrier, color barrier, empty start, stable-order, and articulation-remainder assertions
- **AND THEN** no unrelated UI or payment test is required.
