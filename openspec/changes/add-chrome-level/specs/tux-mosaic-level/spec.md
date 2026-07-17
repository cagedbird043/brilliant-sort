## MODIFIED Requirements

### Requirement: The flagship Tux level SHALL begin a fixed two-level sequence

The production App SHALL load `tux-01` first as a 24-column by 32-row flagship mosaic with between 450 and 550 active target sockets. Inactive coordinates SHALL remain absent around the recognizable Tux silhouette. After Tux reaches settled `Won`, the original contextual replay action SHALL remain available and an independent next-level action SHALL advance to `chrome-01`; production SHALL NOT expose a level picker, random generation, placeholder levels, or persistent progression.

#### Scenario: Loading the flagship canvas
- **WHEN** a new production page session initializes
- **THEN** it loads `tux-01` as the playable level
- **AND THEN** its canonical board reports 24 columns and 32 rows with between 450 and 550 active cells
- **AND THEN** no inactive coordinate produces a target socket, gem identity, or interactive board cell.

#### Scenario: Advancing after Tux victory
- **GIVEN** `tux-01` has reached `Won` and its authoritative arc-light, fireworks, and motion have settled
- **WHEN** the player activates the independent next-level action
- **THEN** the App loads `chrome-01` without page navigation or refresh
- **AND THEN** the Tux replay action was independently available before navigation
- **AND THEN** Chrome begins in canonical `Playing` state with empty Shelf and selection
- **AND THEN** refreshing the document still starts a new session at Tux.
