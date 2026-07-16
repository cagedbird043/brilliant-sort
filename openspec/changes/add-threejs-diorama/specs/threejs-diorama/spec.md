## ADDED Requirements

### Requirement: Shared deterministic game authority
The 3D presentation SHALL load the committed LevelSpec through the existing `GameCoreFactory` and SHALL derive all playable state from `GameCorePort` snapshots and transitions. It MUST NOT reimplement connectivity, extraction, placement, Shelf compaction, victory, global wand, or restart rules in the renderer.

#### Scenario: Initial 3D state matches the authoritative core
- **WHEN** the 3D page finishes loading the committed Tux level
- **THEN** its rendered Board, gems, Shelf, selection, and status correspond to the initial `GameCorePort.snapshot()`

#### Scenario: Accepted 3D input uses the existing command contract
- **WHEN** the player activates a board gem, Shelf slot, target, global wand, or replay control in the 3D presentation
- **THEN** the presentation dispatches the corresponding existing `GameCommand` and renders the returned `CoreTransition`

#### Scenario: Rejected input cannot mutate presentation authority
- **WHEN** the core rejects a command originating from 3D picking or keyboard input
- **THEN** the renderer preserves the authoritative snapshot and presents rejection feedback without applying a speculative game-state mutation

### Requirement: Complete crystal-diorama state mapping
The 3D presentation SHALL render every active Board cell, target, gem, and Shelf slot represented by `GameState`. It SHALL preserve target color, gem color, locked state, selection membership, empty state, and compact Shelf order while presenting the committed Tux silhouette as a shallow low-poly crystal diorama.

#### Scenario: Tux level is complete in 3D
- **WHEN** the committed Tux level is in its initial state
- **THEN** all 546 active Board cells and every configured Shelf slot are represented without omitting, duplicating, or recoloring gameplay state

#### Scenario: Selection is visually distinguishable
- **WHEN** the core returns a non-empty selection
- **THEN** every selected gem is visibly grouped and elevated or illuminated without changing its authoritative coordinate or color

#### Scenario: Locked gems remain readable and immutable
- **WHEN** a gem matches its target color
- **THEN** the 3D scene presents it as seated and locked and does not expose an enabled selection action for it

### Requirement: Deterministic 3D picking and semantic input
Pointer picking SHALL map a visible mesh instance to one stable Board coordinate, gem identifier, or Shelf index before dispatch. The canvas experience SHALL retain semantic controls for keyboard and assistive-technology operation, and focus SHALL have a visible scene-correlated state.

#### Scenario: Pointer selects the intended instance
- **WHEN** a pointer activates the visible center of an enabled gem instance
- **THEN** exactly the command associated with that instance's stable coordinate or Shelf index is dispatched

#### Scenario: Empty target receives a selected component
- **WHEN** a Board selection exists and the player activates a compatible empty target instance
- **THEN** the renderer dispatches `place-selection-at-target` with that target coordinate

#### Scenario: Keyboard operation matches pointer operation
- **WHEN** a player focuses and activates a semantic Board or Shelf control with the keyboard
- **THEN** the same command and visible focus/selection result occur as for the corresponding 3D pointer pick

### Requirement: Responsive bounded camera
The 3D presentation SHALL use a bounded camera composition that keeps the complete playable Board and both Shelf banks discoverable on supported desktop and mobile Chromium viewports. Camera interaction MUST NOT permit the player to lose the board irrecoverably, and restart SHALL restore the default composition.

#### Scenario: Desktop composition is complete
- **WHEN** the 3D page opens at the desktop Playwright viewport
- **THEN** the Board, both Shelf banks, audio control, and global wand are visible without page overflow obscuring gameplay

#### Scenario: Mobile composition is complete
- **WHEN** the 3D page opens at the Pixel 5 Playwright viewport
- **THEN** the Board and Shelf remain operable with touch-sized semantic targets and no horizontal document scrolling

#### Scenario: Replay resets presentation camera
- **WHEN** the player activates contextual replay after victory
- **THEN** the core restarts and the camera returns to the initial zoom, target, and orientation without reloading the page

### Requirement: Event-driven 3D motion and finale
The 3D presentation SHALL derive selection, placement, Shelf compaction, global-wand, victory, and replay motion from accepted core transitions. Motion SHALL finish at geometry that represents the authoritative destination state, and input locking SHALL prevent overlapping commands from creating visual/state divergence.

#### Scenario: Placement lands on the authoritative destination
- **WHEN** the core accepts a Board-to-Shelf, Shelf-to-Board, or Board-to-Board placement
- **THEN** the affected 3D gems travel from their rendered source transforms to their authoritative destination transforms and no flight clone remains afterward

#### Scenario: Global wand reaches deterministic victory
- **WHEN** the player activates the global wand from the initial Tux state
- **THEN** the 3D presentation renders the accepted global transition, ends with every gem at its target, and enters the same won state as the 2D presentation

#### Scenario: Victory exposes contextual replay
- **WHEN** the victory finale completes
- **THEN** the wand is replaced by the replay control and activating it dispatches `restart-level` without a document reload

### Requirement: Reduced-motion and audio preference parity
The 3D page SHALL honor `prefers-reduced-motion`, the existing mute preference, and the existing user-gesture audio lifecycle. Reduced motion SHALL preserve immediate authoritative state changes and operability while removing nonessential object, particle, and camera travel.

#### Scenario: Reduced-motion wand remains playable
- **WHEN** reduced motion is requested and the global wand is activated
- **THEN** the core reaches victory, nonessential 3D travel and finale motion are skipped or completed immediately, and contextual replay becomes available

#### Scenario: Mute preference survives route use and replay
- **WHEN** the player changes mute state and later replays the 3D level
- **THEN** the existing audio preference remains applied and no second AudioContext is required for replay

### Requirement: Bounded rendering cost and resource lifecycle
The committed Tux scene SHALL use instanced or equivalently batched rendering for repeated Board, gem, and Shelf geometry. At the stable initial frame it SHALL remain within 32 renderer draw calls, cap effective device pixel ratio at 2, and release owned GPU resources, animation frames, observers, and event handlers when the 3D root unmounts.

#### Scenario: Initial frame meets the draw-call budget
- **WHEN** the initial Tux scene reaches a stable rendered frame
- **THEN** the renderer reports no more than 32 draw calls and all 546 active cells remain visible

#### Scenario: High-density mobile display is bounded
- **WHEN** the device reports a pixel ratio greater than 2
- **THEN** the renderer uses an effective pixel ratio no greater than 2 while preserving CSS-size interaction coordinates

#### Scenario: Renderer unmount is clean
- **WHEN** the 3D React root unmounts or the page leaves the 3D entry
- **THEN** its animation loop stops and all renderer-owned geometries, materials, textures, observers, listeners, and WebGL resources are disposed exactly once

### Requirement: Deterministic 3D browser evidence
The 3D presentation SHALL expose stable test diagnostics for renderer readiness, camera state, draw calls, picking results, active motion, and authoritative state identity. Browser tests SHALL freeze explicit animation times and camera transforms before comparing desktop and mobile visual baselines.

#### Scenario: Stable visual frame is reproducible
- **WHEN** Playwright loads the same commit, viewport, core state, camera state, and frozen animation time
- **THEN** the resulting 3D canvas matches the committed platform-specific visual baseline within the configured tolerance

#### Scenario: Diagnostics do not become gameplay authority
- **WHEN** test diagnostics are read during browser verification
- **THEN** they report renderer and authoritative-state observations without providing a separate path to mutate game rules
