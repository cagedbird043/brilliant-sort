## ADDED Requirements

### Requirement: The global wand SHALL animate every moved Gem as one bounded full-board wave

When an accepted `apply-global-wand` transition occurs, the renderer SHALL derive moved Gem IDs from stable pre/post locations, not hundreds of semantic placement events. It SHALL measure each source before dispatch and destination after committed layout, hide every moved destination, and animate one full-opacity clone per moved Gem in a deterministic diagonal wave. Curved motion SHALL use transform-only WAAPI keyframes, exact measured endpoints, and the existing Large↔Micro LOD handoff. The `tux-01` locked invariant SHALL bound this wave to at most 136 moved Gems. Input SHALL remain locked through all per-Gem delays and animations, and cleanup SHALL reveal every destination and remove every clone on finish, cancel, unmount, or bounded fallback.

#### Scenario: Solving the initial Tux with the wand

- **GIVEN** the initial Tux has 136 movable Gems and 410 locked Gems
- **WHEN** the in-world wand dispatches `apply-global-wand`
- **THEN** 136 stable-ID clones fly in a deterministic full-board wave while locked Gems remain stationary
- **AND THEN** no moved destination is visible with its clone
- **AND THEN** every clone ends within one CSS pixel of its measured destination before cleanup.

#### Scenario: Flying Shelf Gems into the solved Board

- **GIVEN** a mid-game state contains Large-family Shelf Gems
- **WHEN** the global wand solves the state
- **THEN** each moved Shelf Gem follows the same wave timing while scaling to its Board destination
- **AND THEN** its Large layer switches discretely to the Micro layer before destination handoff.

#### Scenario: Cancelling or timing out the global wave

- **GIVEN** one or more delayed global Gem animations are active
- **WHEN** navigation, unmount, cancellation, or the global safety fallback occurs
- **THEN** every hidden destination is revealed, every clone is removed, and input unlocks
- **AND THEN** the already committed canonical `Won` state remains authoritative.

#### Scenario: Global wand under reduced motion

- **GIVEN** `prefers-reduced-motion: reduce`
- **WHEN** `apply-global-wand` succeeds
- **THEN** no full-board Gem clones or spatial wave run
- **AND THEN** the solved canonical Tux and accessible completion status appear immediately.

### Requirement: Manual and wand victory SHALL share one deterministic arc-light and pixel-firework finale

A transition from `Playing` to `Won` SHALL mount one pointer-transparent finale regardless of whether victory came from normal placement or `apply-global-wand`. The finale SHALL draw one project-owned SVG arc light across the Board and three fixed pixel-firework bursts made from square sparks. Particle positions, colors, directions, distances, and delays SHALL be committed deterministic data; runtime random values SHALL NOT be used. The overlay SHALL remove itself after a bounded duration and SHALL leave the solved Tux visible without replay, next-level, reward, or automatic reset UI.

#### Scenario: Completing the level manually

- **GIVEN** normal placement produces the first `won` event
- **WHEN** the renderer observes the transition
- **THEN** one arc-light sweep and three pixel-firework bursts run
- **AND THEN** the completed Tux remains visible after the overlay cleans up.

#### Scenario: Completing through the global wand

- **GIVEN** `apply-global-wand` produces `global-wand-applied` and `won`
- **WHEN** the full-board Gem wave begins
- **THEN** the arc light leads the diagonal wave and the fixed fireworks begin during its latter half
- **AND THEN** only one finale instance is mounted.

#### Scenario: Finale under reduced motion

- **GIVEN** reduced motion is enabled
- **WHEN** status first becomes `Won`
- **THEN** spatial arc and spark travel are suppressed
- **AND THEN** the final Tux and accessible completion status remain present.

## MODIFIED Requirements

### Requirement: The presentation SHALL remain original and functional

The approved dark pixel cavern SHALL remain visible around the irregular Tux and adaptive Shelf banks. The playable surface SHALL contain no persistent branding, status copy, dashboard frame, reset control, level selector, reward, currency, inventory, lock, payment, or commercial progression affordance. It MAY contain exactly one implemented in-world global-wand assist, the sibling audio mute crystal, and one transient first-visit instruction sentence; none of these may become a dashboard. Implemented Board/Shelf interactions, bounded zoom/pan, assist, onboarding, and audio mute behavior SHALL retain accessible semantics.

#### Scenario: Reviewing the completed game canvas

- **WHEN** a reviewer opens the Tux stage at desktop, square, or portrait aspect
- **THEN** the complete stage is centered and every visible interactive object performs a real implemented action
- **AND THEN** the only non-Board/Shelf controls are the functional audio crystal and global wand
- **AND THEN** no legacy panel, slot number, decorative economy control, or persistent instruction appears.

#### Scenario: Completing the available level

- **WHEN** `GameCorePort` reaches `Won`
- **THEN** the renderer runs the bounded shared arc-light and pixel-firework finale and leaves the solved mosaic visible
- **AND THEN** it shows no completion plaque, next-level action, replay action, reward, or automatic reset.
