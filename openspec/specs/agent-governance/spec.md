# agent-governance Specification

## Purpose
TBD - created by archiving change add-brilliant-sort-core. Update Purpose after archive.
## Requirements
### Requirement: Agent context is constrained to relevant evidence and contracts

The agent tool layer SHALL provide only the rule/spec sections, targeted files, fixtures, acceptance commands, and failure diagnostics needed for a requested change. It SHALL distinguish observed gameplay facts from baseline implementation decisions and deferred extensions.

#### Scenario: Fixing a component-selection regression

- **GIVEN** a failed component fixture and a targeted reducer file
- **WHEN** an agent repair task is created
- **THEN** the task context includes the component requirement, fixture, command trace, and diff
- **AND THEN** it excludes unrelated payment, LiveOps, and deferred power-up implementation context.

### Requirement: Agent changes are validated through the production Harness

An agent SHALL not treat its own explanation as evidence of correctness. Every agent-visible patch SHALL be checked through focused compile/test commands, deterministic scenario replay, or both, using the production reducer and Harness.

#### Scenario: Agent patch fixes a target-color rejection

- **GIVEN** a fixture where a wrong-color target is incorrectly accepted
- **WHEN** an agent patches the reducer
- **THEN** the Harness reruns the focused target-placement test and replay
- **AND THEN** the audit record stores the command and results
- **AND THEN** acceptance is based on the Harness outcome rather than agent prose.

### Requirement: Failures return structured repair feedback

When validation fails, the agent tool layer SHALL return the failing command, command index when applicable, before and after canonical state, events, rejection, expected state when available, actual state, and field-level diff.

#### Scenario: Replay failure feedback

- **GIVEN** a winning replay diverges at command index five
- **WHEN** validation reports failure
- **THEN** the agent receives index five, command payload, prior state, actual next state, expected next state, and semantic diff.

### Requirement: Every visible agent repair is auditable

The system SHALL persist an audit record for each visible agent repair attempt. The record SHALL include rule/spec version, fixture or scenario identity, changed files, validation commands, results, failure reason if any, and the next decision.

#### Scenario: Persisting a successful repair audit

- **GIVEN** an agent patch passes its focused test and replay
- **WHEN** the repair completes
- **THEN** an audit record names the rules relied on, modified files, commands run, and passing results.

### Requirement: Unspecified-rule conflicts stop automation

If a requested change requires an unconfirmed gameplay rule or conflicts with a baseline requirement, the agent SHALL stop before inventing behavior. It SHALL report the conflict and request human clarification.

#### Scenario: Requesting an unsupported power-up behavior

- **GIVEN** a task asks the agent to implement a deferred power-up whose command semantics are absent from baseline specs
- **WHEN** the agent evaluates the task
- **THEN** it does not add speculative reducer behavior
- **AND THEN** it reports that the rule is deferred and requires a new approved specification.

