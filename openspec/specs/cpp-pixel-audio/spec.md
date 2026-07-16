# cpp-pixel-audio Specification

## Purpose
TBD - created by archiving change add-cpp-pixel-audio-engine. Update Purpose after archive.
## Requirements
### Requirement: Pixel audio SHALL run in an isolated C++ engine

The system SHALL implement `PixelAudioEngine` as a headless C++ module with a native offline renderer and a separate Emscripten Wasm AudioWorklet target. Audio clocks, score position, voices, mute preference, and output state SHALL NOT enter `BrilliantSortCore`, `LevelSpec`, `GameState`, canonical dumps, or gameplay command results.

#### Scenario: Playing with audio initialization failure

- **WHEN** the audio module, worklet, or output device fails to initialize
- **THEN** the game loads and accepts the same commands through `GameCorePort`
- **AND THEN** canonical state and replay output are identical to an audio-enabled run.

#### Scenario: Building independent WASM modules

- **WHEN** the production browser artifacts are built
- **THEN** game rules and realtime audio are emitted as independently loadable WASM modules
- **AND THEN** disabling the audio module does not change the game-core ABI or fixture bytes.

### Requirement: Synthesis SHALL have a deterministic 16-bit reference

The engine SHALL use integer/fixed-point phase, envelope, scheduling, and mix state with a widened mix bus saturated to signed 16-bit PCM. Exact waveform determinism SHALL be defined by the fixed 48kHz native offline profile; browser output SHALL convert the final reference-range sample to Web Audio float without becoming canonical gameplay state.

#### Scenario: Rendering a fixed score twice

- **WHEN** the native renderer processes the same score, fixed seed, cue log, sample rate, and duration twice
- **THEN** both signed 16-bit PCM byte streams and hashes are identical
- **AND THEN** peak and RMS diagnostics are identical.

#### Scenario: Rendering at a browser device rate

- **WHEN** the AudioWorklet runs at a supported non-48kHz device rate
- **THEN** musical event order, pitch relationships, cue order, and loop structure remain correct
- **AND THEN** the device waveform is not required to match the 48kHz hash byte-for-byte.

### Requirement: Runtime sound SHALL be generated without sample assets

The initial synth SHALL provide pulse duty voices, triangle bass, multi-band saw/wavetable, sine-table two-operator FM, and fixed-tap LFSR noise, with bounded ADSR, vibrato, portamento, duty sweep, arpeggio, and gain parameters. Runtime production SHALL NOT require MP3, OGG, WAV, external sample packs, browser oscillator graphs, or a third-party synth dependency.

#### Scenario: Building the production audio bundle

- **WHEN** production assets are inspected
- **THEN** music and gameplay effects are produced by `PixelAudioEngine` score/instrument data
- **AND THEN** no recorded audio file is fetched or bundled for runtime playback.

#### Scenario: Playing a high-register saw note

- **WHEN** an authored saw/wavetable instrument enters its highest supported register
- **THEN** the engine selects an appropriate bounded band/table
- **AND THEN** output remains within the accepted aliasing and peak limits.

### Requirement: The Tux score SHALL use authored constraints and deterministic variation

The repository SHALL contain one reviewed Tux score definition with fixed tempo, ticks per beat, scale, chord progression, motifs, rhythm masks, instruments, arrangement, loop boundaries, progress thresholds, permitted transformations, and a fixed seed. The sequencer MAY apply only declared motif rotation, octave displacement, chord-tone substitution, bounded note omission, and arpeggio-order transformations; it SHALL NOT choose notes outside the configured scale/chord grammar or use an unseeded source.

#### Scenario: Replaying the constrained super-loop

- **WHEN** the same score seed, loop index, and progress layer are rendered
- **THEN** every algorithmic transformation and note event occurs at the same sample position
- **AND THEN** the resulting fixed-rate PCM is byte-equivalent.

#### Scenario: Rejecting unconstrained score data

- **WHEN** a score transformation requests an out-of-grammar note, invalid rhythm mask, unsupported instrument, unbounded voice count, or missing seed
- **THEN** score validation fails before the realtime engine starts
- **AND THEN** the engine does not improvise a fallback melody.

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

### Requirement: Browser audio SHALL start only from a real user interaction

The App MAY preload the audio module, but it SHALL resume audible Web Audio only within the first pointer or keyboard activation of an actionable board or Shelf cell. The same gesture SHALL still execute its gameplay command. The App SHALL NOT show a start overlay, autoplay audible output on load, retry resume in a timer loop, or make audio success a gameplay prerequisite.

#### Scenario: Opening the page without interaction

- **WHEN** the page and audio module finish loading before any user gesture
- **THEN** the puzzle is fully visible and playable while the audio context remains non-audible/suspended as required by the browser
- **AND THEN** no modal or instructional copy blocks the board.

#### Scenario: Making the first puzzle move

- **WHEN** the player first activates an actionable cell
- **THEN** the App attempts to resume the context and dispatches that same gameplay interaction
- **AND THEN** a rejected resume leaves the gameplay command/result intact and the game silent.

#### Scenario: Returning from background suspension

- **WHEN** the browser suspends and later resumes the audio context
- **THEN** the score resumes at the configured current-pattern or next-boundary policy without simulating missed wall-clock samples
- **AND THEN** no gameplay command or progress change is emitted by audio lifecycle.

### Requirement: A cavern crystal SHALL provide accessible persistent mute control

One project-owned cavern crystal SHALL be rendered as an in-world semantic toggle with keyboard activation, focus visibility, touch target, dynamic accessible name, and `aria-pressed` state. Its lit/dim treatment SHALL communicate enabled/muted state without text or a dashboard icon. Mute preference SHALL persist locally and master gain SHALL ramp over a bounded interval to avoid clicks.

#### Scenario: Muting from the cavern

- **WHEN** the player activates the lit audio crystal
- **THEN** master output ramps to silence, the crystal becomes visibly dim, `aria-pressed` reflects muted state, and preference is persisted
- **AND THEN** music transport and gameplay state remain independent.

#### Scenario: Loading with a persisted mute preference

- **WHEN** a returning browser has persisted mute enabled
- **THEN** no audible output starts after the first gameplay gesture until the crystal is activated again
- **AND THEN** the puzzle remains usable without an additional prompt.

#### Scenario: Unmuting a suspended context

- **WHEN** the player activates the muted crystal while the browser audio context is suspended
- **THEN** that gesture attempts context resume before ramping gain
- **AND THEN** failure leaves the crystal/state consistently muted and never blocks gameplay.

### Requirement: Realtime rendering SHALL be bounded and independently verifiable

The AudioWorklet render callback SHALL use preallocated voices, queue storage, score data, and buffers and SHALL perform no allocation, lock, I/O, parsing, logging, sleep, or unbounded loop. Verification SHALL cover deterministic offline PCM, voice/cue bounds, clipping, loop continuity, mute ramps, browser worklet startup, supported browser lifecycle, and silent failure behavior independently of game-core differential replay.

#### Scenario: Auditing one realtime render block

- **WHEN** the worklet requests its audio frame block
- **THEN** `Render` completes using bounded work proportional to fixed voices and frame count
- **AND THEN** instrumentation reports zero allocation and no blocking operation in the callback.

#### Scenario: Protecting output level

- **WHEN** the maximum authored music layers and a maximum bounded placement chord coincide
- **THEN** widened mixing and final saturation produce finite samples within the accepted peak limit
- **AND THEN** the offline validation reports no wraparound, NaN, or uncontrolled hard clipping.

#### Scenario: Deploying the audio worklet

- **WHEN** the production page loads the separate audio module on supported desktop and mobile browser engines
- **THEN** the worklet processor can initialize, receive cues, render, mute, suspend, and resume
- **AND THEN** failure at any stage resolves to the silent port without preventing Tux startup or command handling.

