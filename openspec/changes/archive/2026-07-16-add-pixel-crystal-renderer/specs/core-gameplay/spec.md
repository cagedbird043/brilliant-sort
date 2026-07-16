## RENAMED Requirements

- FROM: `### Requirement: Presentation delegates all gameplay mutation to the reducer`
- TO: `### Requirement: Presentation delegates all gameplay mutation to the core port`

## MODIFIED Requirements

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
