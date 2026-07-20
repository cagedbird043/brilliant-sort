## 1. Core Semantics

- [x] 1.1 Remove TypeScript connectivity filtering and Shelf compaction connectivity simulation while preserving frontier and anchor ordering.
- [x] 1.2 Remove obsolete TypeScript Selection-connectivity helpers and exports.
- [x] 1.3 Apply the same latched Selection semantics to native/WASM C++ and remove obsolete connectivity helpers.

## 2. Regression Evidence

- [x] 2.1 Replace the TypeScript safe-extraction assertion with an articulation-point regression that moves the bridge and retains disconnected endpoints.
- [x] 2.2 Add a native C++ protocol regression for the same articulation-point transition.
- [x] 2.3 Update the differential scenario to run the middle-anchor counterexample across TypeScript, native C++, and WASM.
- [x] 2.4 Confirm existing presentation coverage renders authoritative `selection.gemIds` without requiring connected geometry.

## 3. Current Documentation

- [x] 3.1 Update current OpenSpec context, README, and evidence material to describe the post-submission correction.
- [x] 3.2 Preserve `SUBMISSION.md` and generated submission HTML unchanged as historical artifacts.

## 4. Risk-Driven Quality Audit

- [x] 4.1 Audit compiler warnings and existing static-analysis configuration; fix evidenced defects without introducing a new dependency.
- [x] 4.2 Run the native core under ASan and UBSan and retain a reproducible command.
- [x] 4.3 Record why TSan is or is not applicable to each native target instead of adding a non-exercising gate.
- [x] 4.4 Audit existing unit, differential, property/fuzz, coverage, performance, and deterministic replay checks; add only a focused check with a concrete invariant or threshold.

## 5. Verification

- [x] 5.1 Run focused TypeScript, native C++, WASM differential, OpenSpec, and browser smoke verification.
