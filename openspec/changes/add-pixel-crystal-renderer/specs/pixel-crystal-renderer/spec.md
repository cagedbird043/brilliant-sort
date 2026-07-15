## ADDED Requirements

### Requirement: Runtime pixel assets SHALL pass the asset pipeline before promotion

The renderer SHALL import runtime PNGs only from `src/assets/pixel/`. Every promoted asset SHALL first pass `pixel-bloom inspect`; reviewed gem variants SHALL be derived through the committed semantic palette manifest. The application SHALL not import a candidate from ignored `art/inbox/` or generated review output from `art/review/`.

#### Scenario: Promoting a reviewed gem family

- **WHEN** the reviewed ice master passes `pixel-bloom inspect`
- **THEN** the project derives `ice`, `navy`, `coral`, and `jade` runtime PNG variants through the committed palette manifest
- **AND THEN** each runtime variant preserves the approved master geometry and Alpha mask.

#### Scenario: Rejecting an unreviewed candidate path

- **WHEN** a candidate PNG exists only under `art/inbox/`
- **THEN** the game renderer does not import it
- **AND THEN** the candidate cannot affect the deployed presentation until it is inspected and promoted.

### Requirement: Board cells SHALL compose target, socket, shadow, and gem layers

Each active board cell SHALL remain an accessible semantic button while visually composing a target-color underlay, the approved neutral socket sprite, an optional pixel shadow, and an optional gem sprite. The visual layer order SHALL keep a gem readable above its socket while retaining its target color beneath a mismatched movable gem.

#### Scenario: Rendering an empty target

- **WHEN** an active board cell has no gem
- **THEN** it renders the target-color indicator and neutral socket sprite
- **AND THEN** it communicates an available target without relying only on text or a generic dashed circle.

#### Scenario: Rendering a movable mismatched gem

- **WHEN** a board cell contains a gem whose color differs from the cell target color
- **THEN** the gem sprite renders above the target-color/socket layers
- **AND THEN** the target color remains visually discoverable beneath it.

#### Scenario: Rendering a locked matching gem

- **WHEN** a board cell contains a gem whose color matches the target color
- **THEN** the gem is visibly seated in its socket and not visually styled as a movable selection target
- **AND THEN** its existing accessibility label continues to identify it as locked/fixed.

### Requirement: The Shelf SHALL render as a continuous pixel buffer rail

The Shelf SHALL retain its twelve-column row-major semantics and accessible button slots while rendering a continuous code-defined rail behind individual approved shallow tray sprites. Every occupied slot SHALL render its gem sprite above its tray; every empty slot SHALL expose its shallow empty tray.

#### Scenario: Rendering a compact twelve-slot Shelf

- **WHEN** the game renders the Shelf at any supported viewport width
- **THEN** it retains twelve ordered slots with the same row-major index semantics
- **AND THEN** it does not become a carousel, reorder slots, or horizontally overflow the viewport.

#### Scenario: Placing a selected board gem into an empty Shelf slot

- **WHEN** a board selection is stored in the Shelf
- **THEN** each resulting Shelf gem renders above a tray at its reducer-defined index
- **AND THEN** the board/Shelf command behavior and `data-testid` values remain unchanged.

### Requirement: Pixel artwork SHALL retain crisp visual geometry and accessible hit areas

Runtime sprite images SHALL preserve aspect ratio and use pixel-aware rendering. Interactive board and Shelf buttons SHALL retain usable hit areas independent of source sprite dimensions. The renderer SHALL replace generic CSS-gradient gem bodies, porcelain target blocks, and generic Shelf slots with the approved pixel material system.

#### Scenario: Viewing at a portrait mobile viewport

- **WHEN** the game is viewed at approximately 390 CSS pixels wide
- **THEN** sprites remain visually crisp and fully visible within their interactive cells
- **AND THEN** the board, twelve-slot Shelf, and HUD have no horizontal overflow.

#### Scenario: Viewing at a desktop viewport

- **WHEN** the game is viewed at a desktop viewport
- **THEN** the game canvas remains board-dominant and does not expand runtime sprites into blurred, arbitrary-scale decoration.

### Requirement: The view SHALL provide reducer-derived tactile motion without changing gameplay state

The presentation layer SHALL derive a motion plan from pre-command and post-command `GameState` locations keyed by stable gem IDs. It SHALL not change reducer inputs, reducer outputs, LevelSpec, Shelf rules, selection rules, or victory conditions.

#### Scenario: Selecting movable gems

- **WHEN** a movable connected component is selected
- **THEN** each selected gem lifts above a detached pixel shadow
- **AND THEN** locked matching gems remain visually seated and are not included in the lift.

#### Scenario: Placing a selected gem

- **WHEN** a reducer command places a selected gem into a target or Shelf slot
- **THEN** the view animates a temporary sprite ghost from the measured source location to the measured destination location when both locations are available
- **AND THEN** the destination responds with a short pixel-aware landing/settle effect without delaying the reducer state update.

#### Scenario: Compacting the Shelf

- **WHEN** a Shelf placement causes the reducer to emit `shelf-compacted`
- **THEN** remaining Shelf gems animate toward their new stable row-major indices using their gem IDs
- **AND THEN** the final DOM order exactly matches reducer state.

#### Scenario: Rejecting an invalid command

- **WHEN** a reducer command is rejected
- **THEN** the view gives local rejection feedback without moving a gem or changing state
- **AND THEN** it preserves the existing accessible rejection message.

### Requirement: Motion SHALL provide a reduced-motion equivalent

The renderer SHALL honor `prefers-reduced-motion: reduce`. Reduced-motion mode SHALL suppress spatial flight, lift, shake, and compaction animation while immediately presenting the correct final reducer state and preserving all interactions, focus behavior, and accessible feedback.

#### Scenario: Playing with reduced motion enabled

- **WHEN** a user enables reduced motion and selects, places, rejects, or compacts gems
- **THEN** no spatial sprite ghost or board/Shelf shake runs
- **AND THEN** all resulting game state and status messages remain correct.

### Requirement: The presentation SHALL remain original and functional

The dark crystal-repair workbench SHALL use project-owned sprites and code-rendered structure. It SHALL not introduce copied game art, non-functional coin/power-up/lock UI, payment affordances, or commercial progression controls.

#### Scenario: Reviewing the completed game canvas

- **WHEN** a reviewer opens the game after the pixel renderer cutover
- **THEN** all visible controls correspond to currently implemented gameplay actions
- **AND THEN** no decorative economy or unimplemented power-up controls appear.
