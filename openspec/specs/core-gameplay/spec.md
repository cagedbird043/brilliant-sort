# core-gameplay Specification

## Purpose
TBD - created by archiving change add-brilliant-sort-core. Update Purpose after archive.
## Requirements
### Requirement: Fixed level fixtures preserve world conservation

The system SHALL load baseline levels from versioned fixed `LevelSpec` JSON and SHALL not require runtime RNG or a seed to construct baseline state. A loaded state SHALL contain exactly one occurrence of every gem identity across board and Shelf. For every color, the number of world gems of that color SHALL equal the number of active board cells with that target color.

#### Scenario: Reloading a fixed level is canonical

- **GIVEN** a valid fixed LevelSpec and no prior command state
- **WHEN** the level is loaded twice
- **THEN** both canonical state dumps are byte-equivalent
- **AND THEN** both states have the same active board cells, gem identities, gem colors, Shelf sequence, and status.

#### Scenario: Rejecting a color-unbalanced fixture

- **GIVEN** a LevelSpec whose red gem total differs from its red target-cell total
- **WHEN** fixture validation runs
- **THEN** loading is rejected with a color-conservation diagnostic
- **AND THEN** no playable state is produced.

### Requirement: Movability and locked gems are derived from colors

The system SHALL classify a non-empty board cell as locked exactly when its gem color equals its target color. It SHALL classify a non-empty board cell as movable exactly when the colors differ. Locked gems SHALL never be selected, extracted, moved to Shelf, or moved by any baseline command.

#### Scenario: Clicking a locked gem

- **GIVEN** an active board cell with a blue target and a blue gem
- **WHEN** `SelectBoardGem` targets that cell
- **THEN** the reducer returns `LockedGem`
- **AND THEN** board, Shelf, selection, and status remain unchanged.

### Requirement: Selection uses same-color movable eight-neighbor components

The system SHALL select the maximal same-color movable component containing a clicked board or Shelf gem. Two members are adjacent when their logical cells touch in any of eight directions. A differently colored gem, an empty cell, an inactive cell, or a locked board gem SHALL not connect a component path.

#### Scenario: Selecting a diagonal component

- **GIVEN** two movable red board gems that touch only diagonally
- **AND GIVEN** no intervening eligible path is needed
- **WHEN** one gem is selected
- **THEN** both gems appear in the selection.

#### Scenario: A locked same-color gem breaks a path

- **GIVEN** movable red gems on opposite sides of a locked red gem with no alternate eligible path
- **WHEN** one movable red gem is selected
- **THEN** the selection excludes the movable red gem on the far side.

#### Scenario: Selecting a Shelf component after board selection

- **GIVEN** a lifted board selection and a same-color connected Shelf component
- **WHEN** `SelectShelfGem` targets that Shelf component
- **THEN** the board selection is cleared without moving its gems
- **AND THEN** the Shelf component becomes the only selection.

### Requirement: Partial extraction preserves selected connectivity

When a selected component is partially moved, the system SHALL remove only a candidate whose removal leaves the remaining selected members empty or eight-neighbor connected. A candidate MUST be on the component frontier and safe to remove. The reducer SHALL rank candidates by Chebyshev distance to the immutable initial selection anchor, then row, then column.

#### Scenario: A line middle gem cannot be extracted first

- **GIVEN** a selected horizontal three-gem component with `A=(0,0)`, `B=(0,1)`, and `C=(0,2)`
- **AND GIVEN** the initial anchor is `B`
- **AND GIVEN** only one destination slot is available
- **WHEN** one gem is extracted
- **THEN** `A` is extracted because `A` and `C` tie on anchor distance and `A` has the lower column
- **AND THEN** `B` is not extracted
- **AND THEN** the remaining selection is connected.

#### Scenario: Remaining selected gems stay lifted

- **GIVEN** a selected component larger than its destination capacity
- **WHEN** eligible members are partially moved
- **THEN** unmoved members remain selected
- **AND THEN** they form one connected component.

### Requirement: Matching target components receive batch placement

The system SHALL accept a target placement only on an active, empty board cell whose target color equals the selected color. It SHALL find that cell's maximal same-target-color empty eight-neighbor component and fill as many of its cells as source members allow. Target cells SHALL be ordered by distance to the clicked target anchor, then row, then column. Every placed gem SHALL become locked immediately.

#### Scenario: Source is smaller than matching target component

- **GIVEN** three selected movable white gems
- **AND GIVEN** a clicked empty white target component with five cells
- **WHEN** `PlaceSelectionAtTarget` is applied
- **THEN** three target cells are filled and locked
- **AND THEN** two target cells remain empty
- **AND THEN** selection is cleared.

#### Scenario: Source is larger than matching target component

- **GIVEN** five selected movable white gems
- **AND GIVEN** a clicked empty white target component with three cells
- **WHEN** `PlaceSelectionAtTarget` is applied
- **THEN** three target cells are filled and locked
- **AND THEN** two gems remain selected and connected.

#### Scenario: Wrong-color target rejects without dropping selection

- **GIVEN** a lifted white selection
- **AND GIVEN** an empty blue target cell
- **WHEN** `PlaceSelectionAtTarget` targets the blue cell
- **THEN** the reducer returns `TargetColorMismatch`
- **AND THEN** the original white selection remains unchanged.

### Requirement: Selection cancellation and replacement do not move unplaced gems

A selection SHALL be cancelable. Selecting another eligible component SHALL replace the current selection. Cancellation and replacement SHALL only change selection state; gems that have not already been placed SHALL remain at their original logical locations.

#### Scenario: Cancelling selection

- **GIVEN** a lifted board component whose gems have not moved
- **WHEN** `CancelSelection` is applied
- **THEN** selection becomes null
- **AND THEN** all gems remain in their pre-selection board cells.

### Requirement: Victory is the only terminal baseline status

The system SHALL set status to `Won` exactly when every active board cell contains a gem matching its target color and Shelf is empty. The baseline SHALL not expose `Lost`, timer expiration, move exhaustion, or no-move terminal states. Rejected commands SHALL leave a playing game in `Playing`.

#### Scenario: Winning after the final Shelf gem is placed

- **GIVEN** every board cell except one is locked
- **AND GIVEN** Shelf contains exactly one gem matching the final empty target cell
- **WHEN** that gem is placed into the target
- **THEN** Shelf becomes empty
- **AND THEN** status becomes `Won`.

#### Scenario: Invalid command is not a loss

- **GIVEN** a game in `Playing`
- **WHEN** a wrong-color target placement is attempted
- **THEN** the command is rejected
- **AND THEN** status remains `Playing`.

### Requirement: Presentation delegates all gameplay mutation to the core port

The UI, Harness, and any engine adapter SHALL render state and dispatch commands only through `GameCorePort`. They SHALL not directly mutate board cells, Shelf contents, gem locks, selection membership, or game status. After differential parity is accepted, the browser production `GameCorePort` SHALL be backed by WebAssembly C++ `BrilliantSortCore`; the TypeScript reducer MAY remain only as a test oracle.

#### Scenario: Equivalent UI and Harness action

- **GIVEN** the same canonical LevelSpec state
- **WHEN** the browser `GameCorePort`, Harness `GameCorePort`, and native C++ core dispatch the same command
- **THEN** all executions produce byte-equivalent canonical next-state dumps and equivalent ordered events/rejections
- **AND THEN** no presentation layer mutates game state outside the core port.

#### Scenario: Browser core initialization fails

- **GIVEN** the production browser cannot initialize its WebAssembly C++ core
- **WHEN** the player attempts to start the game
- **THEN** the application presents an explicit initialization failure
- **AND THEN** it does not silently execute commands through the TypeScript reference reducer.

### Requirement: Shelf is a compact configured-capacity storage sequence

The Shelf SHALL contain one ordered compact sequence whose capacity is declared by LevelSpec. Board-origin selection placement SHALL append safely extracted members to the lowest free Shelf indices until either Shelf is full or selection is empty. Removing a Shelf gem SHALL compact all later members toward lower indices. Presentation MAY divide the sequence into banks but SHALL NOT create independent bank state, routing rules, or compaction order. The production `tux-01` level SHALL configure sixteen slots.

#### Scenario: Partial absorption into available Shelf slots

- **GIVEN** a connected board selection of twenty gems
- **AND GIVEN** the Tux Shelf has sixteen free slots
- **WHEN** `PlaceSelectionInShelf` is applied
- **THEN** sixteen safe candidates are appended in source-priority order
- **AND THEN** four selected gems remain connected
- **AND THEN** Shelf is full.

#### Scenario: Row-major compaction after removing a Shelf gem

- **GIVEN** the compact Shelf sequence `[A, B, C, D, E, F, G, H]`
- **WHEN** `B` leaves Shelf
- **THEN** the compact sequence becomes `[A, C, D, E, F, G, H]`
- **AND THEN** each surviving gem's new logical index is independent of which visual bank renders it.

#### Scenario: Full Shelf rejects incoming board selection

- **GIVEN** a full configured-capacity Shelf and a lifted board selection
- **WHEN** `PlaceSelectionInShelf` is applied
- **THEN** the reducer returns `ShelfFull`
- **AND THEN** the board selection remains unchanged.

#### Scenario: Splitting one sequence into two visual banks

- **GIVEN** the sixteen-slot Tux Shelf contains gems at logical indices `0` through `9`
- **WHEN** presentation renders indices `0` through `7` in Bank A and `8` through `15` in Bank B
- **THEN** canonical Shelf state remains one sequence of ten gem IDs
- **AND THEN** removing an early Bank A gem compacts later Bank A and Bank B members by the same global index order.

### Requirement: The global wand SHALL solve canonical state deterministically

The core SHALL accept `apply-global-wand` while status is `Playing`. It SHALL leave every locked matching Board Gem in its current cell, collect all remaining Board and Shelf Gems by color, pair lexicographically sorted Gem IDs with row-major unmatched same-color target cells, clear Shelf and selection, and produce `Won`. It SHALL preserve every Gem identity, Gem color, target color, active cell, configured Shelf shape, and per-color world total. It SHALL emit exactly one aggregate `global-wand-applied` event before the existing transition-to-`won` event and SHALL NOT emit one semantic placement event per Gem.

#### Scenario: Applying the wand from the initial Tux state

- **GIVEN** `tux-01` contains 410 locked matching Gems and 136 movable mismatches
- **WHEN** `apply-global-wand` is dispatched
- **THEN** all 410 locked Gems remain in their original cells
- **AND THEN** the 136 movable Gems are assigned to same-color unmatched targets by stable color/Gem-ID/row-major order
- **AND THEN** Shelf and selection are empty and status is `Won`
- **AND THEN** events are ordered as `global-wand-applied`, then `won`.

#### Scenario: Applying the wand from a mid-game state with Shelf contents

- **GIVEN** a valid `Playing` state with empty Board targets, movable Board Gems, and one or more Shelf Gems
- **WHEN** `apply-global-wand` is dispatched
- **THEN** every Board and Shelf Gem identity occurs exactly once on Board
- **AND THEN** every Gem color matches its target color
- **AND THEN** the configured Shelf sequence is empty without changing its capacity or width.

#### Scenario: Applying the wand after victory

- **GIVEN** status is already `Won`
- **WHEN** `apply-global-wand` is dispatched
- **THEN** the existing `game-won` rejection is returned
- **AND THEN** no global-wand or duplicate won event is emitted
- **AND THEN** canonical state is unchanged.

#### Scenario: Replaying the global wand across backends

- **GIVEN** the same valid LevelSpec and pre-wand canonical state
- **WHEN** the TypeScript Oracle, native C++ core, and WASM `GameCorePort` dispatch `apply-global-wand`
- **THEN** their canonical dumps are byte-equivalent
- **AND THEN** their ordered events and rejection envelopes are equivalent.

