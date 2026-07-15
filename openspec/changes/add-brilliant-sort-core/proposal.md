# Proposal: Add Brilliant Sort Deterministic Core

## Core Rule Summary (8 lines)

1. Each active board cell has a target color and may hold one independently colored gem.
2. A gem is movable iff its color differs from its board target; matched gems are permanently locked.
3. A click selects the maximal same-color movable component under eight-neighbor adjacency.
4. Partial movement removes only safe boundary members, so the remaining lifted component stays connected.
5. Matching empty target components receive batch placement; unmatched target clicks reject without changing selection.
6. Shelf is a compact twelve-column buffer; moved-out entries compact in row-major order.
7. Gems and per-color totals are conserved; fixed LevelSpec fixtures are deterministic.
8. The only baseline terminal state is victory: all board cells match and Shelf is empty.

## Why

The assessment requires a credible core-logic and engineering design for a Brilliant Sort-style puzzle, not a screenshot mock or a guessed commercial-game clone. The essential gameplay loop must be expressed as deterministic state transitions that a UI, a Harness, and an AI repair loop can all drive through one rule authority.

The completed gameplay interview established the baseline facts needed for that loop: color mismatch determines movability, selection uses same-color movable eight-neighbor components, partial movement must preserve the remaining component's connectivity, Shelf storage is compact and row-major, and victory occurs only when every active board cell matches and Shelf is empty. The assessment's C++ exercise independently confirms that connected movable-gem traversal is a central capability.

## What Changes

- Define a fixed JSON `LevelSpec` and canonical `GameState` for pixel-art puzzle fixtures.
- Specify a pure command reducer for selecting components, safely extracting boundary gems, batch-filling matching target components, Shelf storage, cancellation, and victory.
- Define deterministic state serialization, fixture loading, replay, trace, assertions, and field-level diagnostics for a Harness.
- Define an AI-agent repair loop constrained by rule facts, acceptance fixtures, audit records, and structured failure feedback.
- Specify the required C++ `FindConnectedMovableGems` function, stable traversal order, edge behavior, tests, and its relationship to placement priority.
- Record power-ups, persistent purchases, payment prompts, commercial progression, random generation, and random mode as deferred extensions rather than baseline implementation obligations.

## Baseline Scope

The baseline is a playable and testable core loop for fixed level fixtures. UI may be minimal and vector/procedural, but it must dispatch commands to the same reducer used by the Harness. It includes a fixed twelve-column Shelf and the rule behavior necessary to move gems into and back out of it.

## Non-Goals

- Recreating every commercial screen, level, power-up, or monetization behavior.
- Integrating real payment, account, cloud, or LiveOps services.
- Implementing runtime procedural generation or seed-driven random mode.
- Claiming unobserved production tie-breaks as gameplay facts.
- Making UI animation the source of rule truth.

## Impact

New capability specifications are added for core gameplay, Harness automation, AI-agent governance, and the C++ connected-gem exercise. The implementation phase will introduce the corresponding core, fixture, Harness, UI adapter, agent-tool, and C++ test artifacts in dependency order.
