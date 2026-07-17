## ADDED Requirements

### Requirement: Chrome SHALL be an approved four-color pixel mosaic

The second production level, `chrome-01`, SHALL be authored on a 32-column by 32-row canvas with exactly 562 active target sockets. Its solved target SHALL reproduce the approved modern Chrome pinwheel using only `coral`, `amber`, `jade`, and `navy`; inactive coordinates SHALL form the circular exterior, center ring, and three tangent blade seams.

#### Scenario: Loading the approved Chrome canvas
- **WHEN** `chrome-01` is compiled and loaded
- **THEN** its canonical board reports 32 columns, 32 rows, sixteen Shelf slots, and 562 active cells
- **AND THEN** only coral, amber, jade, and navy occur as target or gem colors
- **AND THEN** no inactive coordinate produces a target socket, gem identity, or interactive board cell.

#### Scenario: Rendering project-owned Chrome artwork
- **WHEN** the solved Chrome board is rendered in production
- **THEN** existing project-owned Micro gem assets form the recognizable four-color mark
- **AND THEN** no external reference image, remote image request, or runtime logo bitmap is required.

### Requirement: Chrome source maps SHALL compile canonically

The human-reviewable source SHALL contain equal-sized fixed-width `targets` and `gems` rows using a declared four-symbol palette and `.` for inactive coordinates. The existing deterministic map compiler SHALL emit canonical `LevelSpec v1` cells in row-major order with coordinate-derived gem identities, exact color conservation, and byte-equivalent regeneration.

#### Scenario: Recompiling Chrome without drift
- **WHEN** the same `chrome-01.map.json` is compiled twice
- **THEN** both emitted fixtures are byte-equivalent
- **AND THEN** project verification fails if the committed generated fixture differs from a fresh compile.

#### Scenario: Rejecting an invalid Chrome map
- **WHEN** the source changes the active mask between target and gem rows, declares an unsupported palette color, or violates per-color conservation
- **THEN** compilation fails with the offending map fact
- **AND THEN** no stale or visually plausible replacement fixture is accepted.

### Requirement: The initial Chrome state SHALL be dense and deterministic

Between 70% and 80% of Chrome active cells SHALL begin matched and locked. Every remaining cell SHALL contain an authored mismatched movable gem whose color count is conserved; runtime random generation SHALL NOT alter the initial topology between loads.

#### Scenario: Constructing the Chrome opening state
- **WHEN** `chrome-01` is loaded repeatedly
- **THEN** every canonical initial dump is byte-equivalent
- **AND THEN** its matching ratio remains within 70%–80%
- **AND THEN** every mismatched color has a destination in the target map.

### Requirement: Chrome SHALL carry cross-backend solvability evidence

The repository SHALL commit `chrome-01.win.json` with accepted board and Shelf interaction followed by a winning completion. Replaying it from the compiled initial state SHALL reach `Won` with every active target matched and Shelf empty in the TypeScript oracle, native C++, and WASM.

#### Scenario: Replaying the committed Chrome solution
- **WHEN** differential verification replays `chrome-01.win.json`
- **THEN** every command produces byte-equivalent canonical state, ordered events, and rejection data across all three backends
- **AND THEN** the final state is `Won`, all 562 gems are locked, and Shelf is empty.
