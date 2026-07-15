## MODIFIED Requirements

### Requirement: Command application returns a complete transition trace

The Harness SHALL expose `command.apply(command)` through a selected `GameCorePort`. A transition SHALL include command input, canonical before/after state, emitted events, nullable rejection, and field-level diff. Differential mode SHALL run the same command through TypeScript reference, native C++, and WebAssembly C++ backends before accepting a transition.

#### Scenario: Applying a rejected target placement across backends

- **GIVEN** a lifted selection and an empty wrong-color target in a fixed scenario
- **WHEN** differential Harness mode applies the placement command
- **THEN** TypeScript reference, native C++, and WebAssembly all return the same rejection code/detail and byte-equivalent before/after dumps
- **AND THEN** the report identifies every backend and the command index if any result differs.

### Requirement: Replay is deterministic and diagnostic

The Harness SHALL expose replay for a selected production core port and a differential replay mode. Differential replay SHALL compare byte-equivalent canonical dumps, ordered events, and rejection code/details at every command index across TypeScript reference, native C++, and WebAssembly C++.

#### Scenario: Replay identifies the first cross-language divergence

- **GIVEN** a fixed scenario and command log where any backend diverges at one transition
- **WHEN** differential replay runs
- **THEN** it reports fixture metadata, command index, command JSON, backend, before/after dumps, first JSON-path mismatch, events, and rejection difference
- **AND THEN** verification fails before browser production cutover.
