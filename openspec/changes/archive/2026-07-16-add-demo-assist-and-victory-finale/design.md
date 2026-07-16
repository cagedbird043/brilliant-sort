## Context

The production App already has the boundaries needed for a correct global finale:

```text
C++20 BrilliantSortCore   canonical LevelSpec/GameState/commands/events
GameCorePort              synchronous loaded-session dispatch boundary
stable Gem IDs            pre/post location comparison and replay diagnostics
WAAPI coordinator         measured source/destination clones and input settlement
Tux fixture               546 active cells, 410 immutable locked, 136 movable maximum
```

The existing ordinary motion coordinator derives moved IDs from `gem-placed` events and animates direct source-to-destination transforms. The new global command must rearrange every movable gem atomically, including gems currently in Shelf, without producing hundreds of semantic placement events. Presentation therefore needs a special aggregate event and a state-diff motion plan while preserving the same one-visible-representation invariant.

The current specification also deliberately keeps the cavern wordless and excludes power-up controls. This change supersedes only that narrow product decision: it adds one implemented in-world assist and one transient onboarding sentence. It does not add inventory, currency, purchase, local wand targeting, rewards, next-level UI, or a general HUD.

## Goals / Non-Goals

**Goals:**

- Make a global solve a real deterministic command in TypeScript, native C++, and WASM.
- Preserve every Gem ID/color, every locked matching placement, one compact Shelf invariant, and exact backend parity.
- Animate every actually moved gem across the full board in a bounded diagonal wave, including Shelf Large→Board Micro motion.
- Share one deterministic arc-light/pixel-firework finale between manual and wand victory.
- Explain the interaction once with one sentence, then restore the visually quiet cavern.
- Preserve accessibility, reduced motion, cleanup safety, mobile fit, and static deployment.

**Non-Goals:**

- A local/dragged wand, multiple power-ups, inventory, currency, purchase, cooldown, score, reward, progression, replay, or reset UI.
- Recoloring Gem objects, replacing Gem IDs, moving locked gems, changing LevelSpec, or storing assist use in canonical state.
- Runtime-random fireworks, a general particle engine, Canvas/WebGL migration, physics, or 546 simultaneous arbitrary clones.
- Making onboarding copy permanent, multi-step, modal, interactive, translated by runtime services, or canonical gameplay state.
- Adding a new audio ABI. The existing `won` cue/fanfare remains the terminal audio response.

## Decisions

### 1. Add one deterministic `apply-global-wand` core command

`GameCommand` gains:

```json
{ "type": "apply-global-wand" }
```

For each color, the reducer performs the following on a cloned/mutable next state:

1. Walk active Board cells in row-major order.
2. Leave a cell unchanged when it contains a Gem whose color matches its target.
3. For every other active cell, add its coordinate to `targets[targetColor]`; if it contains a Gem, add that Gem ID to `sources[gem.color]`; then clear the cell.
4. Add every Shelf Gem ID to its color source bucket.
5. Sort every source bucket lexicographically by Gem ID. Target buckets are already row-major and MAY be sorted defensively.
6. Require source/target counts to match for every color; mismatch is an internal invariant failure, not a new player rejection.
7. Assign source IDs one-to-one to target coordinates, clear Shelf, clear selection, and resolve status.

The aggregate transition is:

```text
events = [global-wand-applied(movedCount), won]
rejection = null
status = Won
```

The command preserves locked cells, identity uniqueness, color totals, configured Shelf shape, and canonical ordering. Existing pre-dispatch `game-won` handling makes repeated use idempotent from the player's perspective: it rejects without another event or finale.

Alternative considered: change each Gem color to its target. Rejected because it destroys the world-conservation and stable-identity contracts. Alternative considered: dispatch the committed 48-command winning trace. Rejected because it depends on one fixture's authored path, creates intermediate selection/Shelf state, and cannot solve arbitrary valid states.

### 2. Derive global moved IDs from state, not hundreds of events

`global-wand-applied` detail contains only the moved count. The renderer constructs stable location maps for `beforeState` and `result.state`, then chooses Gem IDs whose container/coordinate changed. This handles Board permutation cycles and Shelf→Board placement without bloating the protocol or audio cue stream.

Ordinary commands retain event-derived motion. A `PendingMotion` records `kind: standard | global-wand`; only the global plan applies delays and curved wave keyframes. The final state commits immediately, all moved destinations remain hidden, and source clones are the sole visible representations until settlement.

### 3. Bound the Tux global wave and batch its DOM work

The flagship starts with 410 locked matching gems. Locked gems never become movable, so any valid `tux-01` state has at most 136 globally moved gems. The coordinator measures all sources before dispatch and all destinations in one layout effect, builds clones in a `DocumentFragment`, then appends once.

For each moved Gem:

```text
projection = normalized(destination.left + destination.top)
delay      = projection * 520ms
duration   = 460ms
midpoint   = 55% translation + bounded upward arc
endpoint   = exact measured destination + destination/source scale
```

The curved path uses three transform keyframes and stable geometry only. It does not animate width/height or use runtime randomness. Same-family Micro→Micro flights keep one sprite layer; Shelf Large→Board Micro flights use the existing discrete LOD handoff. The outer clone remains fully opaque.

Input remains locked through every delayed outer animation and LOD animation. Cleanup always reveals destinations, cancels animations, removes clones, and releases input on finish, cancellation, unmount, or a bounded global safety fallback. Standard movement keeps its current short timing.

### 4. Let the arc light lead the wave and overlap deterministic fireworks

A `VictoryFinale` overlay mounts when status first transitions to `Won`, regardless of whether the last command was manual placement or global wand. It contains:

- one SVG arc path whose stroke reveals left-bottom to right-top using `stroke-dasharray`/`stroke-dashoffset`;
- three fixed pixel-firework bursts at approved percentage coordinates;
- fixed square sparks with CSS custom properties for direction, color, delay, and distance;
- no labels, buttons, rewards, or automatic state changes.

The arc begins immediately. Firework bursts begin during the latter half of the global wave and still read correctly after a short manual final placement. The overlay is pointer-transparent and removes itself after the bounded finale while the solved Tux remains.

No random API is used. Fixed particles make screenshots and E2E deterministic. Reduced motion suppresses spatial gem flight, arc travel, and particle travel; the final Tux and accessible `Won` status appear immediately with at most a static brief highlight.

### 5. Add one real in-world wand control

The wand is one semantic `<button>` positioned opposite the audio crystal, outside the Board/Shelf coordinate layout. It uses project-owned inline SVG/CSS pixel geometry, a stable `data-testid="global-wand"`, keyboard focus, and `aria-label="一键完成关卡"`. It is disabled during motion, boot, or `Won` and dispatches only `apply-global-wand`.

The control is functional rather than decorative. It does not introduce inventory count, price, cooldown, confirmation, tooltip stack, or panel chrome.

### 6. Show one transient, persisted onboarding sentence

The exact copy is:

```text
点击同色宝石，经缓冲槽放回同色空位；也可以点魔法棒一键修复整幅 Tux。
```

A versioned local key records completion. On a first visit the sentence appears as a light, pointer-transparent line near the safe viewport edge, never over the Board or Shelf. The first accepted Board, Shelf, or global-wand command hides it and persists the key. Rejected actions do not hide it. Storage read/write failures degrade to page-lifetime behavior and never block play.

The hint is ordinary visible text with accessible semantics; it is not an `aria-live` loop. Reduced motion removes its fade duration but preserves its one-time behavior.

## Risks / Trade-offs

- **[Many simultaneous clones]** → locked invariants bound Tux to 136; batch insertion, transform-only motion, diagonal delays, one measurement phase, and desktop/mobile E2E keep the cost bounded.
- **[Atomic state appears before flight]** → every moved destination is hidden during the authoritative clone wave; locked stationary pixels remain visible.
- **[Permutation cycles overlap]** → stable ID source clones and hidden final destinations avoid dependency on move order.
- **[Global command diverges across languages]** → identical bucket ordering and per-transition TS/native/WASM differential tests are mandatory before UI cutover.
- **[Celebration restarts on render]** → mount one keyed finale only on the `Playing → Won` transition; repeated won commands reject.
- **[Onboarding breaks wordless direction]** → one exact transient sentence only, persisted after the first accepted command; no persistent HUD copy.
- **[Fireworks become flaky]** → no random values; fixed particles, delays, positions, and reduced-motion assertions.

## Migration Plan

1. Add and strictly validate this OpenSpec delta.
2. Add the command/event to TypeScript and focused reducer tests.
3. Port the identical deterministic assignment to C++, then prove native/WASM/Oracle parity from initial and mid-game states.
4. Add the real wand control and state-diff global motion mode behind the accepted command.
5. Add the shared arc/firework finale and one-time hint.
6. Smoke the real browser on desktop and 390px mobile, including full wave, manual win, wand win, persistence, reduced motion, cleanup, and audio continuity.
7. Run full Bun/C++/WASM/differential/E2E/strict-spec verification and deploy.
8. Archive only after human product acceptance of the full-map wave, fireworks, control, and hint.

## Open Questions

None. Global scope, deterministic reassignment, full moved-gem wave, shared finale, exact hint copy, persistence boundary, and reduced-motion behavior are approved by the owner.
