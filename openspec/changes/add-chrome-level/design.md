## Context

Production currently imports `tuxLevel` directly in `App.tsx`, creates one WASM core for that fixture, and turns every victory into a same-level replay action. The core, map compiler, reducer oracle, WASM port, and stage solver are already level-generic; the missing work is an approved second fixture plus a small presentation-owned sequence.

The approved Chrome draft is a 32×32 modern flat mark with a pinwheel outer ring, a navy center, and transparent separation. The runtime must render that shape through existing Micro gem sprites and sockets rather than loading the external reference images or the temporary `art/inbox` candidate.

## Goals / Non-Goals

**Goals:**
- Ship `chrome-01` as the second production level after `tux-01`.
- Preserve canonical `LevelSpec v1`, existing gameplay rules, and exact TypeScript/native/WASM replay parity.
- Preserve the wordless full-screen stage while making board semantics and level controls level-aware.
- Keep the approved four-color geometry recognizable at desktop and narrow mobile sizes.

**Non-Goals:**
- No level picker, map screen, unlock economy, random generation, URL routing, or persistent progression.
- No new core command, WASM ABI, color, gem sprite family, audio composition, or runtime image dependency.
- No automatic transition before the player activates the post-victory control.
- No change to the root behavior on refresh: a new page session starts at Tux.

## Decisions

### Author Chrome as the same compact map source used by Tux

`src/fixtures/source/chrome-01.map.json` will contain 32 fixed-width target rows and 32 initial-gem rows. Its palette maps `C`, `A`, `J`, and `N` to coral, amber, jade, and navy; `.` remains inactive space. `tools/compile-level-map.ts` will emit `src/fixtures/chrome-01.json` with stable row-major cells and coordinate-derived IDs.

The approved target contains exactly 562 active cells. Transparent cells form the circular exterior, center ring, and three tangent blade seams. The initial gem map will conserve all four color counts while leaving roughly one quarter of active cells mismatched, so the solved image is hidden without turning most of the board into movable noise.

Alternative considered: consume the approved PNG directly. Rejected because the map source is the existing reviewable and deterministic level-authoring contract, while `art/inbox` is intentionally non-production.

### Keep progression in the React presentation

`App.tsx` will own a constant two-entry sequence with each `LevelSpec` and accessible board label. A local `levelIndex` selects the active entry, and one presentation-owned switch routine recreates the core for either legal index while clearing finale, rejection, feedback-motion, and input-lock state. The level ID resets the camera.

On every settled victory, the upper-right assist slot changes from `global-wand` to `replay-level` exactly as it did before multi-level progression. Tux additionally exposes an independent `next-level` control beside that slot only after authoritative motion and the finale settle. Whenever Chrome is active and no authoritative motion is running, a mirrored upper-left `previous-level` action returns to a fresh canonical Tux state. Refreshing still starts Tux, so no persistence or migration is required.

Alternative considered: add progression to the C++ core. Rejected because ordering levels is presentation policy, not a gameplay rule, and would needlessly expand the ABI.

### Reuse the established restart audio transition

Changing levels in either direction will enqueue the existing strictly sequenced `restart` audio cue before loading the new core. This resets the deterministic audio engine without adding a cue kind or a second score; mute state remains owned by the existing browser audio port.

### Verify Chrome as data, gameplay, and presentation

The fixture drift command and hooks will cover both authored production maps. A committed Chrome trace will perform accepted board/Shelf interaction before the global wand finishes the level, and will replay through the reducer oracle, native C++, and WASM backends. Playwright will prove the arc and fireworks become visibly rendered before navigation/replay controls appear, Tux replay and independent next coexist after settlement, same-document Tux↔Chrome switching resets canonically, and desktop/mobile controls remain bounded.

## Risks / Trade-offs

- **Trademark recognition:** The level intentionally evokes Chrome. Runtime files remain project-authored pixel data, external images are not shipped, and the product must not imply Google affiliation.
- **Brief loading gap:** Recreating the WASM core may momentarily render the existing boot state. The implementation should keep the transition deterministic and bounded rather than introducing speculative preloading.
- **Color readability:** Coral and amber are closer than the other pairings at Micro size. The approved pinwheel seams, existing outlines, and final-state browser review are the acceptance gate.
- **Hard-coded sequence:** A two-entry array is intentionally less general than a progression framework. It is the smallest implementation that proves multiple production levels without creating unused infrastructure.
