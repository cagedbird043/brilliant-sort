## ADDED Requirements

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
