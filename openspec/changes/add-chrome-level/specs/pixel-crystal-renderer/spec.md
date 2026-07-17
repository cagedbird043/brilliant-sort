## MODIFIED Requirements

### Requirement: The presentation SHALL remain original and functional

The approved dark pixel cavern SHALL remain visible around the active mosaic and adaptive Shelf banks. The playable surface SHALL contain no persistent branding, status copy, dashboard frame, reset control, level selector, reward, currency, inventory, lock, payment, or commercial progression affordance. During `Playing` it MAY contain the implemented in-world global-wand assist, sibling audio mute crystal, Chrome-only previous-level action, and one transient first-visit instruction sentence. After `Won`, authoritative motion, and the bounded finale settle, the wand slot SHALL become exactly one functional contextual replay control on either level; Tux MAY additionally expose one independent next-level action and Chrome MAY retain its independent previous-level action. Implemented Board/Shelf interactions, bounded zoom/pan, assist, onboarding, audio mute, replay, and navigation behavior SHALL retain accessible semantics.

#### Scenario: Reviewing the completed game canvas

- **WHEN** a reviewer opens either production stage at desktop, square, or portrait aspect
- **THEN** the complete stage is centered and every visible interactive object performs a real implemented action
- **AND THEN** the only non-Board/Shelf controls during `Playing` are audio, wand, and Chrome previous when applicable
- **AND THEN** after settled `Won`, the wand slot is replay while level navigation remains a separate control
- **AND THEN** no legacy panel, slot number, decorative economy control, or persistent instruction appears.

#### Scenario: Completing the available level

- **WHEN** `GameCorePort` reaches `Won`
- **THEN** the renderer runs the bounded shared arc-light and pixel-firework finale and leaves the solved mosaic visible
- **AND THEN** neither replay nor next-level appears while authoritative motion or the finale remains active
- **AND THEN** exactly one contextual replay appears in the former wand slot after settlement
- **AND THEN** Tux additionally exposes one independent next-level action without replacing replay.

### Requirement: Manual and wand victory SHALL share one deterministic arc-light and pixel-firework finale

A transition from `Playing` to `Won` SHALL mount one pointer-transparent finale regardless of whether victory came from normal placement or `apply-global-wand`. The finale SHALL draw one project-owned SVG arc light across the Board and three fixed pixel-firework bursts made from square sparks. Particle positions, colors, directions, distances, and delays SHALL be committed deterministic data; runtime random values SHALL NOT be used. The overlay SHALL remove itself after a bounded duration and SHALL leave the solved active mosaic visible. Replay and next-level controls SHALL remain absent until that overlay has cleaned up.

#### Scenario: Completing the level manually

- **GIVEN** normal placement produces the first `won` event
- **WHEN** the renderer observes the transition
- **THEN** one arc-light sweep and three pixel-firework bursts become visibly rendered
- **AND THEN** the completed mosaic remains visible after the overlay cleans up
- **AND THEN** replay and applicable navigation appear only after cleanup.

#### Scenario: Completing through the global wand

- **GIVEN** `apply-global-wand` produces `global-wand-applied` and `won`
- **WHEN** the full-board Gem wave begins
- **THEN** the arc light leads the diagonal wave and the fixed fireworks begin during its latter half
- **AND THEN** only one finale instance is mounted
- **AND THEN** replay and next-level remain absent until the finale settles.

#### Scenario: Finale under reduced motion

- **GIVEN** reduced motion is enabled
- **WHEN** status first becomes `Won`
- **THEN** spatial arc and spark travel are suppressed
- **AND THEN** the final mosaic and accessible completion status remain present
- **AND THEN** replay and applicable navigation become available immediately.
