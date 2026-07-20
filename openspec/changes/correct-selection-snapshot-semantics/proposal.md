## Why

The submitted reducer promoted eight-neighbor connectivity from a selection-creation rule into a lifetime invariant. Source-video review and a reconstructed articulation-point scenario show the opposite behavior: removing a bridge gem may disconnect the remaining selected gem IDs, which stay lifted as one latched selection. The post-submission code and regression evidence must reflect that product observation without rewriting the historical submission.

## What Changes

- **BREAKING** Remove the `SafeToRemove` connectivity requirement from partial extraction while preserving deterministic candidate ordering and all unrelated eligibility rules.
- Treat Selection as an explicit Gem-ID snapshot created by one same-color movable eight-neighbor BFS; later accepted moves remove IDs from that snapshot without recomputing connectivity.
- Clear or replace Selection only through the established cancel/reselection/empty-selection transitions.
- Add an articulation-point fixture whose bridge gem moves first and whose disconnected remainder stays selected.
- Require the fixture to agree across the TypeScript oracle, native C++ core, and WASM core, with browser coverage for the visible lifted remainder.
- Preserve the submitted behavior and its evidence as historical context; describe this as a post-submission correction rather than retroactively claiming the fixed rule was submitted.
- Audit existing C++ quality gates and add only risk-relevant checks. Sanitizers, static analysis, fuzz/property tests, coverage, and performance checks are accepted only when they exercise a concrete failure mode or invariant; tool badges without an applicable target are out of scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `core-gameplay`: Selection connectivity becomes a creation precondition rather than a lifetime invariant.
- `wasm-game-core`: The production C++ core must implement the corrected latched Selection semantics while retaining protocol and deterministic ordering.
- `game-harness`: Differential and browser regression coverage must include the articulation-point counterexample and identify any backend divergence.
- `agent-governance`: Repairs must preserve source evidence and may not treat multi-agent agreement or shared-spec parity as proof of product correctness.

## Impact

Affected areas include the TypeScript reducer, C++ core, shared Selection helpers, deterministic fixtures/traces, native/WASM parity tests, browser E2E coverage, canonical baselines, and OpenSpec requirements. The JSON protocol and public connected-component exercise remain compatible; only partial-extraction behavior changes. No new runtime dependency is planned.
