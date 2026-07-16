## RENAMED Requirements

- FROM: `### Requirement: Shelf is a compact twelve-column storage sequence`
- TO: `### Requirement: Shelf is a compact configured-capacity storage sequence`

## MODIFIED Requirements

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
