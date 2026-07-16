# tux-mosaic-level Specification

## Purpose
TBD - created by archiving change rebuild-tux-mosaic-stage. Update Purpose after archive.
## Requirements
### Requirement: The flagship level SHALL be one large irregular Tux mosaic

The change SHALL provide exactly one production level, `tux-01`, authored on a 24-column by 32-row canvas with between 450 and 550 active target sockets. Inactive coordinates SHALL remain absent from the board so the cavern is visible around the recognizable Tux Linux penguin silhouette.

#### Scenario: Loading the flagship canvas

- **WHEN** `tux-01` is compiled and loaded
- **THEN** its canonical board reports 24 columns and 32 rows
- **AND THEN** the active-cell count is between 450 and 550
- **AND THEN** no inactive coordinate produces a target socket, gem identity, or interactive board cell.

#### Scenario: Shipping only the approved flagship level

- **WHEN** the production App initializes after this change
- **THEN** it loads `tux-01` as the playable level
- **AND THEN** it does not expose level selection, progression, random generation, or placeholder levels.

### Requirement: Tux artwork SHALL be authored as separate target and gem maps

The human-reviewable source SHALL contain a palette dictionary and equal-sized fixed-width `targets` and `gems` row arrays. `targets` SHALL define the final Tux socket colors; `gems` SHALL define the initial gem colors at the same active coordinates; `.` SHALL identify inactive coordinates in both maps.

#### Scenario: Reviewing color-match data

- **WHEN** an author inspects the Tux map source
- **THEN** the final target artwork and initial gem permutation are independently visible without reading generated coordinate objects
- **AND THEN** every non-void character resolves through the declared palette.

#### Scenario: Rejecting different active masks

- **WHEN** a coordinate is active in exactly one of the target or gem maps
- **THEN** compilation fails with its row and column
- **AND THEN** no runtime LevelSpec is emitted.

### Requirement: The map compiler SHALL emit canonical LevelSpec v1

A deterministic Bun/TypeScript compiler SHALL expand the compact map into the existing `LevelSpec v1` fields and explicit cell list. Gem identities SHALL be derived stably from coordinates, cell order SHALL be canonical row-major order over active coordinates, and regeneration SHALL be byte-equivalent.

#### Scenario: Recompiling an unchanged map

- **WHEN** the same Tux source is compiled twice
- **THEN** both emitted `LevelSpec v1` JSON files are byte-equivalent
- **AND THEN** native C++, WebAssembly C++, and the TypeScript oracle receive the same runtime fixture.

#### Scenario: Detecting stale generated output

- **WHEN** the committed generated fixture differs from a fresh compile of its source map
- **THEN** project verification fails
- **AND THEN** production does not silently consume stale level data.

### Requirement: Tux palette and world colors SHALL be conserved

The Tux target palette SHALL support `obsidian`, `pearl`, `amber`, `navy`, `ice`, and `coral`; the level MAY omit an unused supported color. For every used color, initial gem count SHALL exactly equal active target-socket count, and every gem identity SHALL occur exactly once in world state.

#### Scenario: Rejecting an attractive but unsolvable color map

- **WHEN** a source map contains a gem color count that differs from its target count
- **THEN** compilation fails with per-color expected and actual totals
- **AND THEN** the map is not accepted merely because it renders a recognizable Tux.

#### Scenario: Loading the expanded palette through all cores

- **WHEN** `tux-01` contains the new `obsidian`, `pearl`, or `amber` symbols
- **THEN** TypeScript, native C++, and WASM parse the same canonical color names
- **AND THEN** canonical dumps preserve those names without aliases or presentation-only remapping.

### Requirement: The initial Tux state SHALL be dense but intentionally playable

Between 70% and 80% of active cells SHALL begin with matching locked gems. Every remaining cell SHALL contain a mismatched movable gem whose color has a destination in the target map; initial placement SHALL be authored as connected-component gameplay rather than runtime random permutation.

#### Scenario: Constructing the opening state

- **WHEN** `tux-01` is loaded
- **THEN** the matching ratio is within the configured 70%–80% range
- **AND THEN** every nonmatching gem is movable under the existing color-derived rule
- **AND THEN** no runtime RNG changes component topology between loads.

#### Scenario: Preserving the color-match core loop

- **WHEN** a player moves a mismatched gem away from a Tux coordinate
- **THEN** the underlying target-colored socket remains at that coordinate
- **AND THEN** only a gem of the same color as that socket can lock there.

### Requirement: The Tux fixture SHALL carry cross-backend solvability evidence

The repository SHALL commit a complete winning command trace for `tux-01`. Replaying that trace from the compiled initial state SHALL reach `Won` with every active target matched and the configured sixteen-slot Shelf empty in the TypeScript oracle, native C++, and WASM.

#### Scenario: Replaying the committed Tux solution

- **WHEN** differential verification replays `tux-01.win.json`
- **THEN** every command produces byte-equivalent canonical state, ordered events, and rejection data across all three backends
- **AND THEN** the final state is `Won`, every active gem is locked, and Shelf is empty.

#### Scenario: Rejecting an unproven large fixture

- **WHEN** the Tux map compiles but its committed winning trace is missing or diverges
- **THEN** verification fails before the App switches to that fixture
- **AND THEN** visual approval alone cannot mark the level complete.

