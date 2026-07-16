## ADDED Requirements

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

## MODIFIED Requirements

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

#### Scenario: Navigating the dense Board with assistive technology

- **WHEN** keyboard or assistive-technology navigation enters the Tux stage
- **THEN** only actionable movable cells, Shelf slots, audio mute, wand assist, and enabled camera semantics participate in the interactive sequence
- **AND THEN** labels identify Gem/target state and the wand's one-click completion action.
