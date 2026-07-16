# android-inspired-presentation Specification

## Purpose
TBD - created by archiving change polish-android-inspired-presentation. Update Purpose after archive.
## Requirements
### Requirement: The game SHALL present an original tactile mobile-puzzle material system

The web presentation SHALL use project-owned pixel PNG/SVG/CSS/DOM materials to render a dark crystal cavern, target-colored Micro sockets, faceted Micro board gems, and larger Shelf gems. It SHALL NOT embed, crop, trace, or reproduce a reference-game screenshot or proprietary commercial asset at runtime. A locked matching gem SHALL remain flush and fully legible as part of the Tux image; a movable mismatch SHALL be distinguished by bounded elevation and exposed target rim rather than lower image clarity.

#### Scenario: Distinguishing a locked gem

- **WHEN** a board gem color equals its target-cell color
- **THEN** the rendered gem sits flush at full image-forming clarity and is not presented as movable
- **AND THEN** a mismatched gem of the same color remains distinguishable through elevation and its different target rim.

#### Scenario: Rendering without external game art

- **WHEN** the game is built for production
- **THEN** cavern, Tux map, target sockets, gems, Shelf banks, and overlays come from project-owned assets and configuration
- **AND THEN** the supplied visual reference is used only for composition discussion and is not required at runtime.

### Requirement: The game SHALL use a portrait-first responsive composition

The production stage SHALL render the full Tux mosaic and two Shelf banks as one centered composition within the dynamic viewport and safe area. It SHALL evaluate measured side-bank and top/bottom-bank candidates and select the candidate with the larger legal integer board-cell scale instead of using a width-only breakpoint. Logical Board/Shelf coordinates SHALL remain independent of layout, scale, camera zoom, and pan.

#### Scenario: Playing on a narrow viewport

- **WHEN** the viewport is approximately 390 CSS pixels wide in portrait orientation
- **THEN** Bank A renders above Tux and Bank B below it
- **AND THEN** the complete fit-to-stage composition is centered vertically and horizontally without page scrolling or horizontal overflow
- **AND THEN** bounded board zoom/pan preserves usable logical interaction when fitted cells are below the direct-touch threshold.

#### Scenario: Playing on a desktop viewport

- **WHEN** the viewport is at least 1200 CSS pixels wide and the side-bank candidate yields the larger legal cell size
- **THEN** Bank A renders left of Tux and Bank B right of it
- **AND THEN** the Tux mosaic remains the primary visual focus without a dashboard panel or top-pinned webpage flow.

#### Scenario: Choosing layout for a square or unusual aspect

- **WHEN** both layout candidates fit the viewport
- **THEN** the stage selects the candidate with the larger integer board-cell scale
- **AND THEN** a deterministic orientation tie-break chooses side banks for landscape and top/bottom banks for portrait.

### Requirement: Presentation feedback SHALL reflect reducer output without owning game rules

Selection, successful placement, Shelf compaction, rejection, locked state, repair progress, and victory feedback SHALL derive from `GameState`, `GameEvent`, `Rejection`, or post-transition facts produced by `GameCorePort`. Presentation SHALL NOT mutate board occupancy, Shelf sequence, selection membership, locked state, status, or audio state as a substitute for dispatching core commands. Visible feedback MAY remain wordless while equivalent accessible status remains available off-screen.

#### Scenario: Rendering a rejected move

- **WHEN** the core port returns a rejection for a player command
- **THEN** the UI gives bounded local visual feedback and an accessible rejection status without visible instructional copy
- **AND THEN** canonical game state remains exactly the core result without presentation-side mutation.

#### Scenario: Rendering a successful placement

- **WHEN** the core port emits a placement event
- **THEN** the UI presents one source-to-destination motion followed by a bounded settle state
- **AND THEN** subsequent interaction reads the core's next state rather than animation-owned state.

### Requirement: Motion SHALL be restrained, composited, and accessible

Presentation motion SHALL use short transitions or keyframes limited to transform, opacity, filter, and bounded visual-depth properties. The UI SHALL provide a reduced-motion mode through `prefers-reduced-motion` that eliminates nonessential motion while retaining state clarity.

#### Scenario: Reduced-motion preference

- **WHEN** the user prefers reduced motion
- **THEN** selection, placement, rejection, Shelf, and victory transitions complete without perceptible decorative animation
- **AND THEN** visible state and accessible status text remain available.

### Requirement: Interactive puzzle elements SHALL remain accessible and testable

Movable Board cells, Shelf slots, bounded Board camera interaction, the implemented in-world audio mute control, and the implemented global-wand assist SHALL retain semantic roles, accessible names/states, keyboard focus visibility, and stable browser-test identifiers. Locked decorative cells SHALL not create redundant keyboard stops. The production stage SHALL not require reset, buffer, cancellation, completion, or level-navigation HUD controls, while the core restart command remains available to deterministic tests and Harness replay. The transient onboarding sentence SHALL be readable without entering the focus order.

#### Scenario: Activating the global wand by keyboard

- **GIVEN** status is `Playing` and no motion is active
- **WHEN** keyboard focus activates the global-wand button
- **THEN** exactly one `apply-global-wand` command is dispatched
- **AND THEN** the control disables throughout the authoritative global wave and after `Won`.

#### Scenario: Completing the fixed level after visual refinement

- **WHEN** the browser executes the committed Tux winning interaction flow or the accepted global-wand command
- **THEN** the solved Tux and accessible completion status are presented
- **AND THEN** canonical state reaches `Won` with an empty Shelf.

#### Scenario: Restarting after visual refinement

- **WHEN** a focused test or Harness explicitly dispatches the core restart command
- **THEN** the initial Tux Board and empty Shelf are restored canonically
- **AND THEN** production presentation is not required to expose a persistent reset control.

#### Scenario: Navigating the dense board with assistive technology

- **WHEN** keyboard or assistive-technology navigation enters the Tux stage
- **THEN** only actionable movable cells, Shelf slots, audio mute, wand assist, and enabled camera semantics participate in the interactive sequence
- **AND THEN** labels identify Gem/target state and the wand's one-click completion action.

### Requirement: The first visit SHALL show one transient onboarding sentence

The presentation SHALL show exactly `点击同色宝石，经缓冲槽放回同色空位；也可以点魔法棒一键修复整幅 Tux。` when the versioned onboarding key is absent. The sentence SHALL remain pointer-transparent, accessible, and positioned outside Board, Shelf, audio, and wand hit areas. The first accepted Board, Shelf, or global-wand command SHALL hide the sentence and persist the key; a rejected command SHALL NOT consume it. Storage read/write failure SHALL NOT block gameplay and SHALL degrade to page-lifetime visibility state.

#### Scenario: First visit before any accepted command

- **GIVEN** the onboarding key is absent
- **WHEN** the Tux stage finishes loading
- **THEN** the exact one-sentence instruction is visible and accessible
- **AND THEN** Board, Shelf, audio, wand, camera, and safe-area interaction remain unobstructed.

#### Scenario: First accepted puzzle command

- **GIVEN** the instruction is visible
- **WHEN** a Board selection, Shelf action, or global-wand command is accepted
- **THEN** the instruction hides and the versioned key is persisted
- **AND THEN** reloading the page does not show it again.

#### Scenario: Rejected command before onboarding completion

- **GIVEN** the instruction is visible
- **WHEN** a command is rejected without changing canonical state
- **THEN** the instruction remains visible
- **AND THEN** no onboarding key is written.

#### Scenario: Onboarding with reduced motion or unavailable storage

- **GIVEN** reduced motion is enabled or local storage throws
- **WHEN** onboarding visibility changes
- **THEN** no perceptible fade is required and gameplay remains usable
- **AND THEN** storage failure does not surface a blocking UI error.

