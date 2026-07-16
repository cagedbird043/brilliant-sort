# wasm-game-core Specification

## Purpose
TBD - created by archiving change add-pixel-crystal-renderer. Update Purpose after archive.
## Requirements
### Requirement: The project SHALL provide one complete headless C++ game core

The project SHALL implement the complete current Brilliant Sort rule set in a C++20 `BrilliantSortCore`. It SHALL own LevelSpec loading, board state, gems, selection, eight-neighbor movable components, safe extraction, target placement, Shelf placement/compaction, rejection, restart, ordered events, victory, and canonical state dumps.

The C++ core SHALL not own browser DOM, React, CSS, PNG assets, browser input, animation timing, or visual layout.

#### Scenario: Executing a complete winning trace natively

- **WHEN** native C++ `BrilliantSortCore` loads a fixed LevelSpec and receives the committed winning command trace
- **THEN** every command produces the expected deterministic transition
- **AND THEN** the final state is won with all board targets matched and an empty Shelf.

#### Scenario: Rejecting invalid commands

- **WHEN** the native C++ core receives a locked-gem selection, wrong target, occupied target, full Shelf, or no-selection command
- **THEN** it returns the established rejection code/detail without mutating game state
- **AND THEN** it emits no fabricated placement or compaction event.

### Requirement: The C++ connected-component exercise SHALL be production code

The public `FindConnectedMovableGems` C++ function SHALL preserve its documented stable eight-neighbor behavior and be used by `BrilliantSortCore` for movable component selection. The production core SHALL not contain a duplicate implementation of the same traversal policy.

#### Scenario: Selecting a diagonal component through production commands

- **WHEN** a C++ core command selects a movable gem whose same-color component is connected diagonally
- **THEN** the selection contains the same stable component ordering defined by `FindConnectedMovableGems`
- **AND THEN** locked and different-color cells remain component barriers.

### Requirement: The core SHALL expose a versioned JSON v1 protocol

The core SHALL accept existing semantic `LevelSpec` and `GameCommand` JSON shapes and return a `CoreTransition` JSON envelope with schema version, structured state, ordered events, nullable rejection, and canonical dump. Protocol output SHALL be deterministic and human-readable.

#### Scenario: Dispatching through the protocol

- **WHEN** a consumer loads a LevelSpec JSON session and dispatches a GameCommand JSON
- **THEN** the core returns a JSON v1 transition envelope
- **AND THEN** its state, events, rejection, and canonical dump describe exactly one completed command transition.

#### Scenario: Reporting protocol failure

- **WHEN** a consumer sends malformed JSON, an unsupported schema version, or an invalid protocol message
- **THEN** the core returns an actionable protocol error result or explicit failure status
- **AND THEN** it does not crash the session or silently mutate state.

### Requirement: WebAssembly SHALL expose only a narrow C ABI

The WebAssembly build SHALL export an opaque-session, byte-buffer C ABI for create, dispatch, result length/copy, and destroy. JavaScript SHALL not access C++ STL containers, classes, raw state pointers, or mutable core memory directly.

#### Scenario: Reading a transition from TypeScript

- **WHEN** `WasmGameCore` dispatches a command to the WebAssembly module
- **THEN** it copies the complete JSON result through the documented result buffer boundary
- **AND THEN** it parses a TypeScript transition without retaining a pointer into WASM memory.

### Requirement: The same C++ source SHALL support native and modular WebAssembly targets

CMake SHALL build native C++ test targets and an Emscripten WebAssembly target from the same core source. The WebAssembly output SHALL be an isolated modular ES-module factory usable by browser and Bun/Node consumers.

#### Scenario: Loading the core in a browser application

- **WHEN** the browser initializes `GameCoreFactory.load(levelSpec)`
- **THEN** the TypeScript adapter asynchronously creates an isolated WebAssembly core session
- **AND THEN** React receives a `GameCorePort` before accepting gameplay commands.

### Requirement: TypeScript production consumers SHALL use GameCorePort

React, Harness replay, and Agent audit production paths SHALL consume a TypeScript `GameCorePort`. They SHALL not invoke the TypeScript reducer directly after WASM parity is accepted. The legacy reducer MAY remain only as a differential-test oracle.

#### Scenario: Running the browser production path

- **WHEN** a player starts the deployed browser Demo after WASM cutover
- **THEN** gameplay commands execute through `WasmGameCore`
- **AND THEN** an unavailable WASM core is a visible initialization failure rather than a silent TypeScript-rule fallback.

### Requirement: Differential Harness SHALL prove transition parity before production cutover

The Harness SHALL replay each required fixture/trace through the TypeScript reference reducer, native C++ core, and WebAssembly core. It SHALL compare canonical dumps byte-for-byte, ordered events, and rejection code/details at every command index.

#### Scenario: Detecting a cross-language mismatch

- **WHEN** any backend differs during a replay transition
- **THEN** the differential report identifies the fixture, command index, command JSON, backend, before/after dumps, first JSON-path mismatch, events, and rejection difference
- **AND THEN** the build fails before production cutover.

#### Scenario: Passing all deterministic traces

- **WHEN** every fixed winning, rejection, compaction, partial extraction, and restart trace matches across all three backends
- **THEN** WASM is eligible to become the only production game-core runtime
- **AND THEN** the TypeScript reducer remains test-only.

