## MODIFIED Requirements

### Requirement: Agent context is constrained to relevant evidence and contracts

The agent tool layer SHALL provide only the observed source evidence, rule/spec sections, targeted files, fixtures, acceptance commands, and failure diagnostics needed for a requested change. It SHALL distinguish observed gameplay facts, submitted baseline decisions, post-submission corrections, and deferred extensions. A shared implementation requirement SHALL NOT be presented as independent product evidence.

#### Scenario: Fixing a component-selection regression

- **GIVEN** a failed component fixture and a targeted reducer file
- **WHEN** an agent repair task is created
- **THEN** the task context includes the source-video observation, corrected component requirement, fixture, command trace, and diff
- **AND THEN** it labels the submitted connectivity rule as historical rather than silently rewriting it
- **AND THEN** it excludes unrelated payment, LiveOps, and deferred power-up implementation context.

## ADDED Requirements

### Requirement: Independent agreement does not establish product truth

Agent review SHALL treat compiler, static-analysis, sanitizer, unit, fuzz, property, differential, coverage, performance, replay, and peer-agent results as evidence only for the contracts they exercise. Multiple agents or backends that consume the same requirement SHALL NOT be counted as independent confirmation that the requirement matches the product.

#### Scenario: Three backends agree on an incorrect Selection invariant

- **GIVEN** TypeScript, native C++, and WASM all enforce the same connectivity-preserving extraction requirement
- **AND GIVEN** source evidence shows a disconnected Selection remainder
- **WHEN** an agent evaluates the green differential replay
- **THEN** it reports implementation parity and a product-spec conflict separately
- **AND THEN** it requires an evidence-backed spec correction before accepting the behavior.

#### Scenario: Two reviewer personas approve the same unsupported rule

- **GIVEN** two AI reviewers receive the same unverified Spec and green tests
- **WHEN** both approve a patch
- **THEN** their agreement does not replace an independent fixture or human-owned product decision
- **AND THEN** merge eligibility remains blocked until the missing oracle is supplied.
