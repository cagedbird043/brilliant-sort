## MODIFIED Requirements

### Requirement: Selection uses same-color movable eight-neighbor components

The system SHALL create a Selection by finding the maximal same-color movable component containing a clicked board or Shelf gem exactly once at selection time. Two members are adjacent when their logical cells touch in any of eight directions. A differently colored gem, an empty cell, an inactive cell, or a locked board gem SHALL not connect the initial component path. The resulting ordered Gem IDs SHALL be stored as an explicit Selection snapshot and SHALL NOT be recomputed from later topology.

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
- **AND THEN** the two unmoved Gem IDs remain in the existing Selection snapshot
- **AND THEN** their continued membership does not depend on current connectivity.

#### Scenario: Wrong-color target rejects without dropping selection

- **GIVEN** a lifted white selection
- **AND GIVEN** an empty blue target cell
- **WHEN** `PlaceSelectionAtTarget` targets the blue cell
- **THEN** the reducer returns `TargetColorMismatch`
- **AND THEN** the original white selection remains unchanged.

## REMOVED Requirements

### Requirement: Partial extraction preserves selected connectivity

**Reason**: Source-video review and a reconstructed articulation-point case disprove connectivity as a Selection lifetime invariant.

**Migration**: Use the new `Partial extraction preserves latched selection membership` requirement. Keep connectivity only when creating the initial Selection snapshot.

## ADDED Requirements

### Requirement: Partial extraction preserves latched selection membership

When a selected component is partially moved, the system SHALL choose a currently resolvable frontier member using the immutable initial selection anchor, then row and column as deterministic priority. It SHALL remove only moved Gem IDs from the existing Selection snapshot. The remaining Gem IDs SHALL stay selected even when their current coordinates form multiple disconnected components. An empty remainder SHALL clear Selection.

#### Scenario: An articulation gem moves before its disconnected remainder

- **GIVEN** a selected horizontal three-gem component with `A=(0,0)`, `B=(0,1)`, and `C=(0,2)`
- **AND GIVEN** the immutable initial anchor is `B`
- **AND GIVEN** only one destination slot is available
- **WHEN** one gem is extracted
- **THEN** `B` is extracted because it has the smallest anchor distance
- **AND THEN** `A` and `C` remain in the same Selection snapshot
- **AND THEN** their lack of eight-neighbor connectivity does not clear or split the Selection.

#### Scenario: Remaining selected gems stay lifted after partial placement

- **GIVEN** a selected component larger than its destination capacity
- **WHEN** eligible members are partially moved
- **THEN** every unmoved Gem ID remains selected
- **AND THEN** no component search is rerun over the remainder.

#### Scenario: Moving the final selected gem clears Selection

- **GIVEN** a Selection snapshot containing one Gem ID
- **WHEN** that gem is moved to an accepted destination
- **THEN** Selection becomes null.
