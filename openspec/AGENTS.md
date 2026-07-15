# OpenSpec Authoring Rules

## Evidence labels

Every rule statement in this project must be classified by its source:

- **Observed fact** — directly reported from gameplay and safe to treat as product behavior.
- **Baseline decision** — a deterministic choice made for this vertical slice when gameplay did not reveal a tie-break or internal algorithm.
- **Deferred extension** — known commercial behavior intentionally excluded from baseline acceptance.

Do not silently turn a baseline decision into an observed fact. Do not invent hidden product rules to make a scenario convenient.

## Rule-core boundaries

- All user interaction becomes a command processed by the rule reducer.
- The reducer owns gameplay state and produces next state, events, or a structured rejection.
- Presentation may animate lifted gems, but lifted status cannot change rule eligibility by itself.
- Harness, replay, CLI, AI tools, and UI must call the same reducer.

## Determinism

- Use fixed JSON LevelSpec fixtures; do not introduce runtime randomness into baseline gameplay.
- Canonical serialization must use stable field and coordinate ordering.
- Any priority tie must be specified as a total order.
- A change that makes a replay differ for identical fixture plus command log is a regression.

## Scope discipline

- Do not implement payment, real account persistence, LiveOps, remaining power-ups, random generation, or random mode in the baseline change.
- Preserve extension seams (`PowerUpPolicy`, `PurchasePolicy`, `PresentationAdapter`) without adding speculative production behavior.
- Treat fixed pixel-art LevelSpec files as content source of truth.

## Change discipline

When editing this change, keep `proposal.md`, `design.md`, `tasks.md`, and all affected delta specs consistent. Requirements use `### Requirement:` headings and contain at least one `#### Scenario:` each. Acceptance tests must assert observable behavior, not implementation text.
