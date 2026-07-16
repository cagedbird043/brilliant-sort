## Why

The flagship Tux mosaic needs an audio identity as deliberate as its pixel presentation; imported music files or JavaScript beeps would not match the project's C++/WASM architecture or deterministic tooling. A dedicated realtime synth can produce an original 16-bit-era score and tactile cues without coupling device timing to canonical gameplay state.

## What Changes

- Add a headless C++ `PixelAudioEngine` with a native offline renderer and a separate Emscripten Wasm AudioWorklet target; do not link realtime audio state into `BrilliantSortCore`.
- Generate all runtime sound from preallocated oscillators/wavetables: pulse lead, triangle bass, band-limited saw/wavetable voice, two-operator FM bell, and LFSR noise percussion. No MP3, OGG, WAV, external sample pack, or browser oscillator graph becomes a runtime dependency.
- Use fixed-point phase/envelope sequencing and signed 16-bit PCM as the deterministic synthesis reference, converting to the browser's float output only at the AudioWorklet boundary.
- Add a hand-authored, constrained tracker-style Tux score configuration with fixed tempo, instruments, patterns, loop points, and progress-layer thresholds. Oscillators generate timbre; the composition is reviewed data rather than random melody generation.
- Map presentation-only `AudioCue` packets from accepted `CoreTransition` results: selection color/count, Shelf storage, target placement, Shelf compaction count, rejection code, matched/total progress, and victory. Audio cues consume state facts and never dispatch gameplay commands or mutate canonical state.
- Add synthesized selection, Shelf, placement, rejection, compaction, and victory sounds; color identities use stable pitch/timbre relationships and accepted multi-gem placements can form bounded chords.
- Start/resume the `AudioContext` on the first real board or Shelf interaction to comply with browser autoplay policy without adding a start screen.
- Make one existing cavern crystal an in-world mute control with accessible name/state, keyboard activation, persisted mute preference, and a restrained visual on/off state; do not reintroduce a dashboard HUD.
- Render one seamless 90–120 second loop whose layers enter at configured repair-progress thresholds and hand off to an original Tux victory fanfare at completion.
- Verify native/offline PCM determinism, loop continuity, clipping bounds, zero-allocation realtime rendering, cue ordering, mute/resume behavior, and browser AudioWorklet startup across supported engines.

## Capabilities

### New Capabilities

- `cpp-pixel-audio`: Defines the isolated C++ synth, tracker score, deterministic offline reference, Wasm AudioWorklet runtime, gameplay-to-audio cue bridge, adaptive music layers, synthesized effects, and in-world mute behavior.

### Modified Capabilities

- None. Gameplay and renderer contracts remain authoritative; this capability consumes their stable transition facts without changing core rules or canonical output.

## Impact

- Adds a separate native C++ audio target, Emscripten AudioWorklet/Wasm Worker build, generated browser module, fixed score configuration, audio bridge, cavern-crystal mute interaction, and focused native/browser verification.
- Requires Emscripten audio-worklet linker settings and static hosting of the separate module, while keeping the existing game-core WASM module and replay ABI unchanged.
- Realtime callbacks must be non-blocking and allocation-free; discrete UI cues cross the boundary through a fixed-capacity queue and continuous progress/mute values use bounded atomic or parameter updates.
- Coordinates with `rebuild-tux-mosaic-stage` only through presentation-level transition facts. Either change can be tested independently, and audio failure must never prevent the Tux level from loading or accepting commands.
