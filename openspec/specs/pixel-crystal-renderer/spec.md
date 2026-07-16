# pixel-crystal-renderer Specification

## Purpose
TBD - created by archiving change add-pixel-crystal-renderer. Update Purpose after archive.
## Requirements
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

Each active Tux coordinate SHALL remain an accessible semantic cell while visually composing a target-color underlay, an approved Micro neutral socket, an optional bounded pixel shadow, and an optional Micro gem. The layer order SHALL keep a mismatched movable gem readable while exposing enough target-colored rim to preserve the color-match rule. A locked matching gem SHALL sit flush at full image-forming clarity rather than dimming or shrinking the completed Tux.

#### Scenario: Rendering an empty target

- **WHEN** an active board cell has no gem
- **THEN** it renders the target-color indicator and Micro socket sprite
- **AND THEN** it communicates the exact available target color without text or a generic dashed circle.

#### Scenario: Rendering a movable mismatched gem

- **WHEN** a board cell contains a gem whose color differs from the cell target color
- **THEN** the gem renders slightly raised above the Micro socket
- **AND THEN** the target-color rim remains visibly discoverable beneath it.

#### Scenario: Rendering a locked matching gem

- **WHEN** a board cell contains a gem whose color matches the target color
- **THEN** the gem renders flush, stable, and at full Tux-image clarity
- **AND THEN** it is not visually styled or semantically enabled as a movable selection target.

#### Scenario: Rendering the irregular Tux mask

- **WHEN** the compiled level omits an inactive coordinate
- **THEN** no socket, gem, button, or rectangular board backing renders there
- **AND THEN** the cavern remains visible through that part of the Tux canvas.

### Requirement: Pixel artwork SHALL retain crisp visual geometry and accessible hit areas

Runtime sprite images SHALL preserve aspect ratio and pixel-aware rendering at the integer cell scale selected for the stage. Interactive board and Shelf semantics SHALL remain usable independent of sprite dimensions. The renderer SHALL provide a full-Tux overview at every supported viewport and SHALL enable bounded integer zoom/pan when the fitted portrait cell falls below the direct-touch threshold.

#### Scenario: Viewing at a portrait mobile viewport

- **WHEN** the game is viewed at approximately 390 CSS pixels wide
- **THEN** the complete Tux and both eight-slot banks are centered without page scrolling or horizontal overflow
- **AND THEN** bounded board zoom/pan is available if direct cells are below the interaction threshold
- **AND THEN** zoom does not alter logical coordinates, selection, or Shelf state.

#### Scenario: Viewing at a desktop viewport

- **WHEN** the game is viewed at a desktop viewport
- **THEN** the integer-scaled Tux mosaic is the primary visual focus between two large Shelf banks
- **AND THEN** Micro sprites do not expand into blurred arbitrary-scale decoration.

### Requirement: The view SHALL provide GameCorePort-derived tactile motion without changing gameplay state

The presentation layer SHALL derive one authoritative motion plan from pre-command and post-command `GameCorePort` states keyed by stable gem IDs. It SHALL NOT change core inputs, outputs, LevelSpec, Shelf rules, selection rules, or victory conditions. A gem undergoing source-to-destination flight SHALL have exactly one visible representation until its measured destination is revealed.

#### Scenario: Selecting movable gems

- **WHEN** a movable connected component is selected
- **THEN** each selected gem lifts one bounded pixel-depth step above its target socket
- **AND THEN** locked matching gems remain flush and are not included in the lift.

#### Scenario: Placing a selected gem

- **WHEN** an accepted command moves a gem into a board or Shelf destination
- **THEN** the view captures the source before dispatch and the destination after committed layout
- **AND THEN** one portal-layer clone of the actual sprite moves at full opacity between those rectangles
- **AND THEN** the destination remains hidden until the clone finishes, then reveals before any sequential settle effect.

#### Scenario: Locking input during an accepted spatial transition

- **WHEN** one or more authoritative flight or Shelf-compaction animations start
- **THEN** board and Shelf command input remains locked until every animation finishes, cancels, or reaches the bounded safety fallback
- **AND THEN** the lock timer does not begin before deferred layout measurement or animation start.

#### Scenario: Compacting the Shelf

- **WHEN** a `GameCorePort` transition emits `shelf-compacted`
- **THEN** surviving Shelf gems receive one FLIP transform toward their new global logical indices
- **AND THEN** a gem already represented by a source-to-destination flight does not also receive survivor FLIP or simultaneous landing transform
- **AND THEN** final DOM order exactly matches canonical Shelf state across both banks.

#### Scenario: Rejecting an invalid command

- **WHEN** `GameCorePort` returns a rejected transition
- **THEN** the view gives local rejection feedback without creating a flight clone or moving a gem
- **AND THEN** canonical state and accessible rejection feedback remain unchanged.

#### Scenario: Sampling an in-progress flight

- **WHEN** a browser test samples a moving gem on successive animation frames
- **THEN** the clone begins within one CSS pixel of the measured source and ends within one CSS pixel of the measured destination
- **AND THEN** no frame shows both clone and destination gem, an excursion to the page origin, or a fading drag trail.

### Requirement: Motion SHALL provide a reduced-motion equivalent

The renderer SHALL honor `prefers-reduced-motion: reduce`. Reduced-motion mode SHALL suppress spatial flight, lift, shake, and compaction animation while immediately presenting the correct final reducer state and preserving all interactions, focus behavior, and accessible feedback.

#### Scenario: Playing with reduced motion enabled

- **WHEN** a user enables reduced motion and `GameCorePort` selects, places, rejects, or compacts gems
- **THEN** no spatial sprite ghost or board/Shelf shake runs
- **AND THEN** all resulting game state and status messages remain correct.

### Requirement: The presentation SHALL remain original and functional

The approved dark pixel cavern SHALL remain visible around the irregular Tux and adaptive Shelf banks. The playable surface SHALL contain no persistent branding, status copy, dashboard frame, reset control, level selector, reward, currency, inventory, lock, payment, or commercial progression affordance. During `Playing` it MAY contain exactly one implemented in-world global-wand assist, the sibling audio mute crystal, and one transient first-visit instruction sentence. After `Won`, authoritative motion, and the bounded finale settle, the wand slot SHALL become exactly one functional contextual replay control; it SHALL NOT create a dashboard or remain visible after restart. Implemented Board/Shelf interactions, bounded zoom/pan, assist, onboarding, audio mute, and replay behavior SHALL retain accessible semantics.

#### Scenario: Reviewing the completed game canvas

- **WHEN** a reviewer opens the Tux stage at desktop, square, or portrait aspect
- **THEN** the complete stage is centered and every visible interactive object performs a real implemented action
- **AND THEN** the only non-Board/Shelf controls during `Playing` are the functional audio crystal and global wand
- **AND THEN** the only non-Board/Shelf controls after settled `Won` are the functional audio crystal and contextual replay
- **AND THEN** no legacy panel, slot number, decorative economy control, or persistent instruction appears.

#### Scenario: Completing the available level

- **WHEN** `GameCorePort` reaches `Won`
- **THEN** the renderer runs the bounded shared arc-light and pixel-firework finale and leaves the solved mosaic visible
- **AND THEN** no replay action appears while authoritative motion or the finale remains active
- **AND THEN** exactly one contextual replay action appears after settlement
- **AND THEN** no completion plaque, next-level action, reward, or automatic reset appears.

### Requirement: The Shelf SHALL render as two adaptive pixel banks

The renderer SHALL map one compact configured-capacity Shelf sequence into Bank A followed by Bank B while preserving accessible slot semantics, stable test IDs, and logical indices. The production sixteen-slot Tux Shelf SHALL render eight ordered slots per bank: left/right around Tux in the selected side layout and above/below Tux in the selected stacked layout. Banks SHALL use approved large tray/gem assets without enclosing dashboard panels or independent state.

#### Scenario: Rendering a compact twelve-slot Shelf

- **WHEN** a retained test fixture configures twelve Shelf slots
- **THEN** the renderer preserves all twelve ordered logical slots
- **AND THEN** visual banking does not reorder, omit, duplicate, or horizontally overflow them.

#### Scenario: Placing a selected board gem into an empty Shelf slot

- **WHEN** a board selection is stored in Shelf
- **THEN** each resulting Shelf gem renders above a tray at its `GameCorePort`-defined logical index
- **AND THEN** crossing from Bank A to Bank B does not change append or compaction behavior.

#### Scenario: Rendering the sixteen-slot Tux Shelf

- **WHEN** `tux-01` renders in the side-bank layout
- **THEN** indices `0..7` appear in the left bank and `8..15` in the right bank
- **AND THEN** the same indices appear in top and bottom banks respectively when the stacked layout is selected.

### Requirement: Dense board Micro assets SHALL be reviewed as a separate geometry family

The renderer SHALL use board-specific Micro socket and gem assets whose source geometry is designed for the Tux mosaic's fitted cell sizes. Micro variants SHALL pass `pixel-bloom inspect`, semantic palette derivation, Alpha-mask comparison, and desktop/portrait preview before promotion; they SHALL NOT be arbitrary browser downscales of the larger Shelf family.

#### Scenario: Promoting the Micro family

- **WHEN** the approved Micro master and semantic palette produce `obsidian`, `pearl`, `amber`, `navy`, `ice`, and `coral` variants
- **THEN** every variant preserves one reviewed geometry and binary Alpha mask
- **AND THEN** a dense Tux preview remains crisp at the minimum fitted portrait scale.

#### Scenario: Keeping Shelf assets legible

- **WHEN** board Micro gems and Shelf gems render in the same stage
- **THEN** they use the same semantic color/facet roles
- **AND THEN** Shelf gems remain intentionally larger rather than reusing the Micro dimensions.

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

