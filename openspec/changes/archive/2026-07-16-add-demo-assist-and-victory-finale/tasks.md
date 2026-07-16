# Tasks: Add Demo Assist and Victory Finale

## 1. Canonical global wand

- [x] 1.1 Add `apply-global-wand` and `global-wand-applied` to the shared TypeScript command/event protocol without changing schema version or C ABI shape.
- [x] 1.2 Implement deterministic per-color source/target assignment in the TypeScript Oracle while preserving locked gems, identities, colors, Shelf capacity, selection invariants, and `Won` semantics.
- [x] 1.3 Implement the same assignment, parser, event order, and already-won rejection in native C++ and WASM.
- [x] 1.4 Add initial-state and mid-game focused tests proving conservation, locked immutability, empty Shelf/selection, one aggregate event, one `won`, and canonical three-backend parity.

## 2. In-world assist and full-board flight

- [x] 2.1 Add one accessible project-owned in-world wand control opposite the audio crystal, with stable test ID and no inventory, price, cooldown, confirmation, or panel.
- [x] 2.2 Derive global moved Gem IDs from pre/post stable locations, not per-gem semantic events, and keep ordinary motion event-derived.
- [x] 2.3 Batch at most the valid Tux movable bound into one diagonal delayed WAAPI wave with curved transform-only keyframes, exact measured endpoints, full opacity, and Large↔Micro LOD handoff.
- [x] 2.4 Keep every global destination hidden until its clone settles; lock input through all delays and guarantee cleanup on finish, cancellation, fallback, and unmount.
- [x] 2.5 Provide immediate final state without spatial clones under reduced motion.

## 3. Arc-light and pixel-firework finale

- [x] 3.1 Replace the old victory band with a pointer-transparent SVG arc-light overlay shared by manual and wand victory.
- [x] 3.2 Add three fixed pixel-firework bursts using deterministic square sparks, transform/opacity animation only, and no runtime random values.
- [x] 3.3 Mount the finale once per `Playing → Won` transition, overlap its latter half with the global wave, and leave the solved Tux visible without replay/progression UI.
- [x] 3.4 Suppress arc/particle travel under reduced motion while preserving the final Tux and accessible completion status.

## 4. One-sentence onboarding

- [x] 4.1 Show exactly `点击同色宝石，经缓冲槽放回同色空位；也可以点魔法棒一键修复整幅 Tux。` on first visit without covering Board, Shelf, or controls.
- [x] 4.2 Hide and persist the hint after the first accepted Board, Shelf, or wand command; rejected commands do not consume it.
- [x] 4.3 Make storage failure non-blocking, keep text accessible, and remove transition delay under reduced motion.

## 5. Verification and delivery

- [x] 5.1 Smoke initial and mid-game global solve in the real browser, confirming the complete wave, Shelf Large→Micro members, input lock, final cleanup, arc, fireworks, fanfare, and `Won` state.
- [x] 5.2 Add deterministic core, C++, WASM, differential, audio-cue, browser, mobile, onboarding-persistence, manual-win, wand-win, and reduced-motion regressions after smoke works.
- [x] 5.3 Run `bun run check`, full Playwright desktop/mobile E2E, Tux differential Harness, production build, production startup, and strict OpenSpec validation.
- [x] 5.4 Update maintained README/submission evidence and archive only after human approval of the wand control, full-map wave, finale, and hint.
