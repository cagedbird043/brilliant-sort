## 1. Audio boundary and build proof

- [x] 1.1 Define the fixed-capacity `PixelAudioEngine`, score/instrument, voice, render, and presentation-only `AudioCue` contracts without importing game-core state.
- [x] 1.2 Add native C++ audio-library/offline-renderer targets and a separate Emscripten `brilliant-sort-audio` Wasm AudioWorklet target without changing the existing game-core WASM ABI.
- [x] 1.3 Prove one preallocated C++ oscillator renders through the browser AudioWorklet, starts only from a puzzle gesture, and fails to a silent port without blocking gameplay.

## 2. Deterministic synthesis engine

- [x] 2.1 Implement fixed-point phase, envelope, sample/tick scheduling, widened mixing, signed 16-bit saturation, and browser float conversion with a fixed 48kHz offline profile.
- [x] 2.2 Implement pulse duty, triangle, multi-band saw/wavetable, sine-table two-operator FM, and fixed-tap LFSR noise sources.
- [x] 2.3 Implement bounded ADSR, vibrato, portamento, duty sweep, arpeggio, voice allocation, music/effect voice reservations, and gain/peak protection.
- [x] 2.4 Add render instrumentation proving fixed work, zero allocation, no locks/I/O/parsing/logging, and finite bounded output in every realtime callback.

## 3. Constrained Tux composition

- [x] 3.1 Define and validate `tux-01.music.json` for tempo, scale, harmony, motifs, rhythm masks, instruments, arrangement, loop, thresholds, permitted transformations, and fixed seed.
- [x] 3.2 Implement deterministic motif rotation, octave displacement, chord-tone substitution, bounded omission, and arpeggio ordering without out-of-grammar notes or unseeded choices.
- [x] 3.3 Compose and offline-render the original 90–120 second Tux super-loop with seamless boundary and progress-layer entries.
- [x] 3.4 Compose and synthesize the one-shot Tux victory fanfare and make duplicate `won` cues idempotent.

## 4. Gameplay cues and in-world control

- [x] 4.1 Implement the sequenced bounded cue bridge for selection, Shelf storage, target placement, compaction, rejection, progress, and victory from post-dispatch facts.
- [x] 4.2 Implement color-stable selection pitches plus bounded Shelf, placement chord, compaction tick, rejection chirp, and progress-layer behavior designed for the large Tux moves.
- [x] 4.3 Implement fixed-queue priorities/coalescing with reserved mute/victory delivery and no main-thread or worklet blocking.
- [x] 4.4 Convert one cavern crystal into the accessible keyboard/touch mute toggle with lit/dim state, click-free gain ramps, and persisted preference.
- [x] 4.5 Handle autoplay denial, worklet initialization failure, document suspension, resume, and device sample-rate differences without visible blocking UI or gameplay mutation.

## 5. Working proof and cleanup

- [x] 5.1 Smoke-play the real browser from silent load through first-interaction resume, selections, Shelf movement, placement, rejection, progress layers, mute/unmute, background resume, and victory before adding cleanup coverage.
- [ ] 5.2 Listen-review the offline/native and browser mix on headphones and speakers for melody quality, 16-bit character, cue readability, fatigue, loop seam, and Tux fanfare timing.
- [x] 5.3 Add fixed-PCM hash, score validation, oscillator/envelope, queue priority, clipping, zero-allocation, cue mapping, mute persistence, worklet lifecycle, and silent-fallback tests after the smoke path works.
- [x] 5.4 Verify supported browser engines, mobile first-gesture behavior, production MIME/hosting, native build, AudioWorklet build, Bun checks, and strict OpenSpec validation.
- [ ] 5.5 Update maintained audio architecture/score documentation and archive this change only after human music, effects, and in-world mute approval.
