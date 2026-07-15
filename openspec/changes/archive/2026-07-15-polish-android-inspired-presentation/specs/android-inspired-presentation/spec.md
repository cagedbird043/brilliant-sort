## ADDED Requirements

### Requirement: The game SHALL present an original tactile mobile-puzzle material system

The web presentation SHALL use original CSS/SVG primitives to render a cool light canvas, porcelain-like board and Shelf surfaces, faceted gems, inset slots, and restrained controls. It SHALL not embed, crop, or reproduce proprietary Android-game screenshots, textures, icons, or branding. Gem visual colors SHALL remain distinguishable from their target-cell colors, and a locked gem SHALL visibly use lower saturation/contrast than a movable gem.

#### Scenario: Distinguishing a locked gem

- **WHEN** a board gem color equals its target-cell color
- **THEN** the rendered gem uses the locked visual treatment
- **AND THEN** it remains visibly distinguishable from a movable gem of the same color.

#### Scenario: Rendering without external game art

- **WHEN** the game is built for production
- **THEN** board, gems, Shelf, controls, and overlays are produced from project-owned CSS/SVG/DOM primitives
- **AND THEN** no reference screenshot or extracted commercial asset is required at runtime.

### Requirement: The game SHALL use a portrait-first responsive composition

The primary visual composition SHALL prioritize mobile portrait play: compact HUD, focused board, Shelf, and transient feedback in one vertical game flow. On wider viewports, the game SHALL preserve the focused puzzle canvas and intentional whitespace instead of exposing a dashboard-oriented side panel. Logical Board and Shelf coordinates SHALL remain independent of viewport size.

#### Scenario: Playing on a narrow viewport

- **WHEN** the viewport is approximately 390 CSS pixels wide
- **THEN** the board is fully visible without horizontal scrolling
- **AND THEN** Shelf controls and slots remain touch-actionable
- **AND THEN** the same board command coordinates remain usable.

#### Scenario: Playing on a desktop viewport

- **WHEN** the viewport is at least 1200 CSS pixels wide
- **THEN** the puzzle canvas remains the primary visual focus
- **AND THEN** the game does not turn into a side-panel engineering dashboard.

### Requirement: Presentation feedback SHALL reflect reducer output without owning game rules

Selection, successful placement, Shelf compaction, rejection, locked state, and victory feedback SHALL derive from `GameState`, `GameEvent`, or `Rejection` produced by the reducer. Presentation code SHALL not modify board occupancy, Shelf sequence, selection membership, locked state, or status directly.

#### Scenario: Rendering a rejected move

- **WHEN** the reducer returns a rejection for a player command
- **THEN** the UI displays localized, understandable feedback
- **AND THEN** the canonical game state remains the reducer result without presentation-side mutation.

#### Scenario: Rendering a successful placement

- **WHEN** the reducer emits a placement event
- **THEN** the UI presents a short placement/settling feedback state
- **AND THEN** subsequent interaction reads the reducer's next state rather than animation state.

### Requirement: Motion SHALL be restrained, composited, and accessible

Presentation motion SHALL use short transitions or keyframes limited to transform, opacity, filter, and bounded visual-depth properties. The UI SHALL provide a reduced-motion mode through `prefers-reduced-motion` that eliminates nonessential motion while retaining state clarity.

#### Scenario: Reduced-motion preference

- **WHEN** the user prefers reduced motion
- **THEN** selection, placement, rejection, Shelf, and victory transitions complete without perceptible decorative animation
- **AND THEN** visible state and accessible status text remain available.

### Requirement: Interactive puzzle elements SHALL remain accessible and testable

Board cells, Shelf slots, reset, buffer action, cancellation, and victory actions SHALL retain semantic controls, accessible labels, keyboard focus visibility, and stable browser-test identifiers. Visual refinement SHALL not break the committed winning browser flow or deterministic restart behavior.

#### Scenario: Completing the fixed level after visual refinement

- **WHEN** the browser executes the committed fixed-level winning interaction flow
- **THEN** the victory surface is displayed
- **AND THEN** the same reducer command sequence still reaches `Won` with an empty Shelf.

#### Scenario: Restarting after visual refinement

- **WHEN** the user activates reset from the HUD
- **THEN** the initial fixed board and empty Shelf are restored
- **AND THEN** the reset control remains keyboard-focusable and named for assistive technology.
