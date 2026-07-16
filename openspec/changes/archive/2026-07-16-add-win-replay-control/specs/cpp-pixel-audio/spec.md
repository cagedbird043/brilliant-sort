## MODIFIED Requirements

### Requirement: Gameplay transitions SHALL map to bounded ordered audio cues

The browser presentation SHALL derive fixed-size monotonically sequenced `AudioCue` packets from post-dispatch core facts: `selection(color,count)`, `shelf_store(color,count)`, `target_place(color,count)`, `shelf_compact(movedCount)`, `rejected(code)`, `progress(matched,total)`, `won`, and accepted `restart-level`. Audio cues SHALL consume those facts without dispatching commands, mutating core state, waiting for visual animation, or changing canonical event order. The append-only `restart` cue SHALL use numeric kind `7` without changing the 12-byte packet shape.

#### Scenario: Placing a multi-gem component

- **WHEN** one accepted transition places multiple same-color gems
- **THEN** the bridge emits one aggregated placement cue with color and count rather than one unbounded cue per gem
- **AND THEN** the audio engine produces a bounded interval/chord within its reserved effect voices.

#### Scenario: Receiving a rejected command

- **WHEN** the core returns a rejection without state mutation
- **THEN** the bridge emits one rejection cue carrying the rejection code
- **AND THEN** no placement, compaction, progress, victory, or restart cue is fabricated.

#### Scenario: Filling the realtime cue queue

- **WHEN** low-priority cues exceed fixed queue capacity
- **THEN** selection/progress cues are coalesced or dropped according to declared priority without blocking the main or audio thread
- **AND THEN** mute control, `won`, and `restart` retain reserved delivery capacity.

#### Scenario: Replaying completed Tux

- **WHEN** an accepted `restart-level` transition follows `Won`
- **THEN** the bridge emits exactly one `restart` cue before any later gameplay or victory cue
- **AND THEN** no visual replay timing or page reload is required to reset audio transport.

### Requirement: Music and effects SHALL respond coherently to Tux repair

The accepted score SHALL form one seamless 90–120 second super-loop. Configured music layers SHALL enter at musical boundaries when matched/total progress crosses declared thresholds; color selections SHALL retain stable pitch identities; Shelf, placement, compaction, and rejection SHALL use distinct bounded synthesized articulations. `won` SHALL prevent another ordinary section from starting and SHALL schedule one original Tux victory fanfare for the current run. `restart` SHALL clear active voices, score position/layers, and victory state while preserving mute, diagnostics, the AudioContext, and the worklet instance.

#### Scenario: Crossing a repair threshold

- **WHEN** a progress cue crosses a configured layer threshold between two audio callbacks
- **THEN** the new layer enters at the next declared beat/bar boundary
- **AND THEN** the transport does not restart, jump mid-note, or alter gameplay timing.

#### Scenario: Completing Tux

- **WHEN** the engine receives the first `won` cue of the current run
- **THEN** it schedules the victory fanfare once and suppresses another normal loop section
- **AND THEN** duplicate `won` cues before `restart` do not stack or restart the fanfare.

#### Scenario: Completing Tux again after replay

- **WHEN** the engine consumes `won`, then `restart`, then a later `won`
- **THEN** score transport restarts for the new run and diagnostics report two victory fanfares
- **AND THEN** the player's mute preference remains unchanged.

#### Scenario: Looping without a seam

- **WHEN** the offline renderer crosses the configured super-loop boundary
- **THEN** phase, envelope, effect, and transport state follow the authored loop contract
- **AND THEN** the accepted output contains no discontinuity beyond the configured click/peak threshold.
