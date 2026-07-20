## Context

The current TypeScript and C++ reducers both derive a same-color movable component at selection time, then repeatedly filter extraction candidates through a connectivity predicate. That second predicate came from a submitted Demo assumption, not the observed product: the source video and a reconstructed articulation-point case show the bridge gem moving while the disconnected remainder stays lifted.

The TypeScript oracle, native C++ core, and WASM C++ core currently agree because they share the same requirement. This change therefore needs an evidence-backed contract correction plus a cross-backend counterexample; parity alone cannot establish product truth. The immutable submitted answer and generated HTML remain historical evidence and are not rewritten.

## Goals / Non-Goals

**Goals:**

- Make connectivity a selection-creation precondition only.
- Keep Selection as a latched Gem-ID snapshot until members move, the selection is cancelled/replaced, or it becomes empty.
- Preserve deterministic frontier and anchor ordering while removing connectivity-based candidate rejection.
- Keep TypeScript, native C++, and WASM byte-identical on the corrected counterexample.
- Remove helpers and tests whose only purpose was enforcing the obsolete lifetime invariant.
- Audit quality gates by concrete risk rather than by tool count.

**Non-Goals:**

- Rewriting the submitted answer, generated submission HTML, or Git history.
- Changing the public `FindConnectedMovableGems` exercise; it still defines selection creation.
- Inferring unobserved commercial extraction ordering, Shelf-bank semantics, progression, payment, or other product behavior.
- Adding dependencies or enabling static-analysis, sanitizer, fuzz, coverage, or performance jobs that do not exercise an applicable failure mode.

## Decisions

### Selection remains an explicit identity snapshot

`SelectBoardGem` and `SelectShelfGem` continue to run one eight-neighbor component search and store the resulting stable Gem IDs, color, source container, and anchor. Later placement commands resolve those IDs to current locations and remove only the IDs that actually move. They do not re-run a component search over the remaining selection.

Alternative considered: split a disconnected remainder into multiple selections. Rejected because the observed remainder stays lifted as one previously selected group, and the current state model intentionally permits only one Selection.

### Extraction preserves frontier and anchor ordering, not lifetime connectivity

`getExtractionCandidates` / `GetExtractionCandidates` continue to require a resolvable member on the current frontier and sort candidates by immutable anchor distance, row, and column. The `isConnected8` / `CoordinatesAreConnected` filter is removed. Shelf-origin placement uses the same first sorted candidate after compaction; it no longer simulates compaction solely to prove connectivity.

Alternative considered: allow every selected member, including a fully surrounded interior member. Rejected because the new evidence disproves only the lifetime-connectivity restriction; it does not establish a different accessibility rule.

### One articulation fixture is the acceptance oracle

A three-gem horizontal selection is created from its middle gem while only one Shelf slot is free. The corrected reducer moves the middle bridge first because it is closest to the immutable anchor, then leaves the two endpoint Gem IDs selected despite their disconnection. This exact transition is asserted in the TypeScript reducer and differential Harness. Native C++ gets a direct protocol-level regression as an additional local diagnostic.

The browser presentation already derives lifted state solely from `selection.gemIds`; existing browser coverage continues to prove arbitrary selected IDs render from authoritative state. A new browser-only fixture path is not introduced because it would add a production routing surface solely for a core rule test. The differential fixture is the authoritative end-to-end rule check across production cores.

### Historical and current claims remain separate

`SUBMISSION.md` and `submission/Brilliant-Sort-Answer.html` remain unchanged. Current README/OpenSpec/evidence material is updated to label the old rule as the submitted assumption and the new behavior as a post-submission correction.

### Quality gates are risk-driven

- Native C++ core and connected-component tests run with strict compiler warnings plus ASan/UBSan because they exercise manual memory and ABI boundaries.
- The game core remains single-threaded, so TSan adds no game-rule evidence. The separate native `AudioCueQueue` is an actual single-producer/single-consumer boundary; a 10,000-cue concurrent order/completeness test makes TSan applicable there.
- Fixed three-backend differential replay remains the implementation-parity oracle. A 32-seed, 128-step reducer state-machine sweep separately checks input immutability, deterministic results, rejection immutability, identity conservation, valid Selection references, Shelf capacity, stable targets, and victory consistency.
- No fuzz dependency is added: random parser traffic would not independently validate the product rule that was wrong, while the source-backed articulation counterexample directly does.
- Bun coverage is measured during the audit, but no percentage gate is retained because the report mixes generated WASM and only imported modules. Performance keeps concrete PCM-hash and render-zero-allocation invariants rather than a machine-dependent wall-clock threshold.

## Risks / Trade-offs

- [Existing winning traces may choose different source IDs] → Run all committed traces through all three backends and update only current baselines that change under the approved rule.
- [Removing the connectivity filter could expose an unobserved interior-member rule] → Retain frontier eligibility and deterministic anchor ordering; avoid claiming more than the counterexample establishes.
- [Documentation may mix submitted and corrected behavior] → Keep submitted artifacts immutable and label current docs/evidence as post-submission correction.
- [A large quality-tool rollout could create flaky, low-signal gates] → Add only checks that run successfully and expose a concrete defect; record non-applicable tools explicitly.

## Migration Plan

1. Commit the delta spec and articulation regression before implementation.
2. Update TypeScript and C++ candidate selection in lockstep, removing obsolete connectivity helpers.
3. Run focused reducer/native/differential tests and inspect the first changed trace.
4. Run existing project checks and a browser smoke path.
5. Update current README, OpenSpec context, and evidence material while preserving submitted artifacts.
6. Roll back by reverting the post-submission change; the historical submitted artifacts remain available throughout.

## Open Questions

None. The observed counterexample is sufficient to remove the lifetime invariant while preserving every unrelated ordering and eligibility rule.
