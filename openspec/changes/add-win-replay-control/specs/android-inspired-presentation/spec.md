## MODIFIED Requirements

### Requirement: Interactive puzzle elements SHALL remain accessible and testable

Movable Board cells, Shelf slots, bounded Board camera interaction, the implemented in-world audio mute control, the implemented global-wand assist, and the contextual settled-Won replay action SHALL retain semantic roles, accessible names/states, keyboard focus visibility, and stable browser-test identifiers. Locked decorative cells SHALL not create redundant keyboard stops. The production stage SHALL contain no persistent reset, buffer, cancellation, completion, or level-navigation HUD controls during `Playing`; the existing canonical restart command MAY be exposed only as the contextual replay action after victory motion and finale settlement. The transient onboarding sentence SHALL be readable without entering the focus order.

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

- **GIVEN** status is `Won` and authoritative motion plus the bounded finale have settled
- **WHEN** keyboard focus activates the contextual replay button, or a focused test/Harness explicitly dispatches the core restart command
- **THEN** exactly one `restart-level` command restores the initial Tux Board, empty Shelf, empty selection, and `Playing` status
- **AND THEN** the Board camera returns to its default transform
- **AND THEN** onboarding dismissal and the audio mute preference remain unchanged
- **AND THEN** production presentation exposes no persistent reset control during `Playing`.

#### Scenario: Navigating the dense board with assistive technology

- **WHEN** keyboard or assistive-technology navigation enters the Tux stage
- **THEN** actionable movable cells, Shelf slots, audio mute, wand assist, and enabled camera semantics participate while `Playing`
- **AND THEN** only audio mute and contextual replay remain actionable after settled `Won`
- **AND THEN** labels identify Gem/target state, the wand's one-click completion action, and replay's restart action.

#### Scenario: Replaying with reduced motion

- **GIVEN** `prefers-reduced-motion: reduce` and status transitions to `Won`
- **WHEN** no spatial finale is mounted
- **THEN** the replay action is available immediately
- **AND THEN** activating it restores the initial playable state without a replay transition animation.
