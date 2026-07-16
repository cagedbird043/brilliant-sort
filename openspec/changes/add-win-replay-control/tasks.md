# Tasks: Add Win Replay Control

## 1. Contract and presentation

- [x] 1.1 Add one contextual replay button that replaces the right-side wand only after `Won`, finale completion, and motion settlement.
- [x] 1.2 Dispatch the existing `restart-level` command with no page reload or direct fixture/state reconstruction.
- [x] 1.3 Reset Board camera framing for the new run while preserving onboarding and audio preferences.
- [x] 1.4 Add a project-owned pixel replay SVG, accessible name, keyboard behavior, focus state, and stable test ID.
- [x] 1.5 Expose replay immediately under reduced motion and keep it hidden throughout `Playing`.

## 2. Verification and delivery

- [x] 2.1 Add browser regressions for manual and wand victory timing, keyboard replay, canonical reset, camera reset, persistence, mobile layout, and reduced motion.
- [x] 2.2 Smoke the complete win → finale → replay → playable-again path in real desktop and mobile Chromium.
- [x] 2.3 Run `bun run check`, full desktop/mobile Playwright, production build/startup, and strict OpenSpec validation.
- [ ] 2.4 Update maintained README/submission evidence, regenerate the answer artifacts, and archive only after human visual/product approval of replay.
