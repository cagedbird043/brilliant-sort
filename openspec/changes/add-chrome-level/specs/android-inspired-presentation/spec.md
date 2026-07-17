## MODIFIED Requirements

### Requirement: The game SHALL use a portrait-first responsive composition

The production stage SHALL render the full active production mosaic and two Shelf banks as one centered composition within the dynamic viewport and safe area. It SHALL evaluate measured side-bank and top/bottom-bank candidates and select the candidate with the larger legal integer board-cell scale instead of using a width-only breakpoint. Logical Board/Shelf coordinates SHALL remain independent of level, layout, scale, camera zoom, and pan.

#### Scenario: Playing either level on a narrow viewport
- **WHEN** the viewport is approximately 390 CSS pixels wide in portrait orientation and either Tux or Chrome is active
- **THEN** Bank A renders above the mosaic and Bank B below it
- **AND THEN** the complete fit-to-stage composition is centered vertically and horizontally without page scrolling or horizontal overflow
- **AND THEN** bounded board zoom/pan preserves usable logical interaction when fitted cells are below the direct-touch threshold.

#### Scenario: Playing either level on a desktop viewport
- **WHEN** the viewport is at least 1200 CSS pixels wide and the side-bank candidate yields the larger legal cell size
- **THEN** Bank A renders left of the active mosaic and Bank B right of it
- **AND THEN** the active mosaic remains the primary visual focus without a dashboard panel or top-pinned webpage flow.

#### Scenario: Choosing layout for a square or unusual aspect
- **WHEN** both layout candidates fit the active level
- **THEN** the stage selects the candidate with the larger integer board-cell scale
- **AND THEN** a deterministic orientation tie-break chooses side banks for landscape and top/bottom banks for portrait.

### Requirement: Interactive puzzle elements SHALL remain accessible and testable

Movable Board cells, Shelf slots, bounded Board camera interaction, the in-world audio mute control, global-wand assist, and the contextual settled-Won next or replay action SHALL retain semantic roles, level-aware accessible names/states, keyboard focus visibility, and stable browser-test identifiers. Locked decorative cells SHALL not create redundant keyboard stops. The production stage SHALL contain no persistent reset, completion, level-selection, or level-navigation HUD controls during `Playing`; a next or replay action MAY appear only after authoritative victory motion and finale settlement. The transient onboarding sentence SHALL remain outside the focus order.

#### Scenario: Activating the global wand by keyboard
- **GIVEN** status is `Playing` and no motion is active
- **WHEN** keyboard focus activates the global-wand button
- **THEN** exactly one `apply-global-wand` command is dispatched to the active level
- **AND THEN** the control disables throughout the authoritative global wave and after `Won`.

#### Scenario: Completing either production level
- **WHEN** the browser executes the active level's committed interaction flow or accepted global-wand command
- **THEN** the solved active mosaic and accessible completion status are presented
- **AND THEN** canonical state reaches `Won` with an empty Shelf.

#### Scenario: Advancing from Tux to Chrome
- **GIVEN** Tux status is `Won` and authoritative motion plus the bounded finale have settled
- **WHEN** keyboard focus activates the contextual `next-level` button
- **THEN** Chrome loads without document navigation or refresh in canonical initial `Playing` state
- **AND THEN** the Board camera returns to its default transform
- **AND THEN** onboarding dismissal and audio mute preference remain unchanged
- **AND THEN** the audio bridge emits one ordered restart cue before Chrome interaction begins.

#### Scenario: Replaying Chrome after victory
- **GIVEN** Chrome status is `Won` and authoritative motion plus the bounded finale have settled
- **WHEN** keyboard focus activates the contextual `replay-level` button
- **THEN** exactly one `restart-level` command restores the initial Chrome Board, empty Shelf, empty selection, and `Playing` status
- **AND THEN** the Board camera resets while onboarding dismissal and audio mute preference remain unchanged.

#### Scenario: Navigating either dense board with assistive technology
- **WHEN** keyboard or assistive-technology navigation enters the active stage
- **THEN** actionable movable cells, Shelf slots, audio mute, wand assist, and enabled camera semantics participate while `Playing`
- **AND THEN** after settled `Won`, only audio mute and the level-appropriate contextual action remain actionable
- **AND THEN** board and action labels identify the active mosaic and whether the action advances or replays.

#### Scenario: Exposing post-victory action with reduced motion
- **GIVEN** `prefers-reduced-motion: reduce` and the active status transitions to `Won`
- **WHEN** no spatial finale is mounted
- **THEN** the level-appropriate next or replay action is available immediately
- **AND THEN** activation changes level state without a decorative transition animation.
