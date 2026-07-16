## Context

The core already treats restart as an unconditional canonical command:

```text
restart-level
  -> clone initial state
  -> status Playing
  -> Shelf empty
  -> selection null
  -> no page reload
```

The production App also has the right lifecycle signals: `state.status`, `inputLocked`, and `finaleVisible`. The missing piece is a presentation-owned affordance and a camera reset key. The old product rule explicitly excluded replay UI, so this change updates that narrow decision rather than adding another rule path.

## Goals / Non-Goals

**Goals:**

- Let a player replay the fixed level without refreshing.
- Preserve the solved Tux until the bounded victory finale and gem motion have completed.
- Dispatch the existing core command through `GameCorePort` and reset the Board camera with the new run.
- Keep the control wordless, accessible, deterministic, mobile-safe, and reduced-motion safe.

**Non-Goals:**

- A reset button during `Playing`, confirmation modal, pause menu, next-level action, score, reward, progression, or automatic restart.
- A new core command/event, audio cue, storage key, C++/WASM change, or replay counter in canonical state.
- Clearing the onboarding key or persisted mute preference.

## Decisions

### 1. Replace the settled Won-state wand in place

The top-right control slot has one semantic owner at a time:

```text
Playing or finale/motion active  -> global wand
Won + finale hidden + input free -> replay
```

The replay button uses its own project SVG, `data-testid="replay-level"`, and `aria-label="重新玩这一关"`. Reusing the established slot avoids a third floating control and makes the state change visible without adding text or a completion panel. During the finale the disabled wand remains in place, so the solved image is not immediately covered by a call to action.

### 2. Dispatch `restart-level`; never simulate a reload

Replay calls the same `applyCommand` path as every other production action. An accepted restart increments a presentation-only run token. That token joins the `BoardCamera.resetKey`, forcing zoom and pan back to the initial framing even though the level ID and viewport dimensions are unchanged.

The core transition remains the authority for Board, Shelf, selection, status, events, and activity feedback. The App does not rebuild state from the fixture and does not call `location.reload()`.

### 3. Preserve unrelated page state

Replay does not touch the onboarding key, audio port, mute preference, or AudioContext. The instruction therefore stays dismissed after the first accepted command, and the player's sound choice survives another run. These values are presentation/device preferences, not level state.

The replay control unmounts as soon as the synchronous restart transition commits and the wand returns. This prevents duplicate activation without adding a debounce or asynchronous lock.

### 4. Reduced motion has no waiting period

When reduced motion is enabled, the finale is not mounted. `finaleVisible` is already false, so the replay button appears as soon as canonical status becomes `Won`. Restart itself has no spatial animation.

## Risks / Trade-offs

- **Control discoverability:** A wordless icon is less explicit than a plaque. A familiar circular-arrow silhouette plus the accessible name keeps the cavern quiet while remaining testable.
- **Premature replay:** Showing replay during the finale would let a player erase the result before it lands. Gating on both `finaleVisible === false` and `inputLocked === false` avoids that race.
- **Camera carry-over:** Restarting only the core would preserve zoom/pan. A presentation run token resets camera state without polluting canonical replay.

## Verification

- Win manually and with the global wand; replay appears only after the bounded finale/motion settles.
- Activate replay by mouse and keyboard; the initial canonical Board returns with empty Shelf/selection and `Playing` status.
- Zoom/pan before winning where supported; replay restores the default camera transform.
- Confirm onboarding remains dismissed and mute preference remains unchanged.
- Confirm mobile fit and no overlap with the audio control or stage.
- Confirm reduced motion exposes replay immediately and runs no replay transition animation.
