## Context

The completed core change established a deterministic React presentation adapter, fixed JSON level, Harness replay, browser E2E, and static deployment path. Its current view is intentionally functional but uses a dark technical-workbench composition that does not resemble the calm, light, tactile mobile puzzle observed during gameplay research.

The visual reference is an Android portrait puzzle: cool light-gray canvas, compact top controls, a porcelain-like board outline, glossy jewel pieces, a white/inset Shelf, and restrained toy-like depth. The goal is to capture those material and interaction principles with original CSS/SVG construction, not reproduce proprietary art, icons, screenshots, or branding.

## Goals / Non-Goals

**Goals:**

- Make the first visual read a polished, portrait-first gem puzzle rather than an engineering dashboard.
- Preserve all existing reducer commands, fixed fixture behavior, accessibility labels, Harness output, and browser test IDs.
- Establish a reusable visual token system for board, gem, locked, Shelf, control, overlay, and feedback states.
- Make selected, locked, invalid, compacting, and winning states visually distinct without moving rule ownership into the UI.
- Keep the static bundle dependency-free beyond the existing React/Vite stack and support `prefers-reduced-motion`.

**Non-Goals:**

- Pixel-for-pixel replication of the commercial Android app.
- New game rules, power-ups, coin purchases, mobile native packaging, Canvas/Pixi, or Cocos runtime migration.
- Replacing the core reducer or changing any fixture/replay command sequence.
- Adding animated spectacle, scroll effects, or a marketing landing page around the game.

## Decisions

### 1. Use an original porcelain-and-jewel material system

The visual thesis is **"a small porcelain jewel tray on a quiet mobile work surface"**. Tokens will use cool light neutrals rather than the current dark console palette:

```text
Canvas       #E8E9EE  soft cool gray
Porcelain    #F9FAFD  board and Shelf surface
Chrome       #C6CDDB  seams and recess edges
Ink          #4E5B84  labels and controls
Navy gem     #5262D7
Ice gem      #53CBE8
Coral gem    #FF706B
Jade gem     #58C987
Accent gold  #F7C95F  selected/focus feedback
```

Each gem remains CSS-generated: layered highlight, directional facet, dark lower bevel, and low shadow. This gives tactile depth without downloading or copying mobile-game assets. Locked gems use lower saturation and contrast; the visual difference maps directly to the immutable locked predicate.

**Alternative rejected:** raster screenshots, extracted game assets, or a generic glassmorphism dashboard. They create legal/design debt, blur at scale, or look unrelated to a touch puzzle.

### 2. Make the game canvas portrait-first but desktop-aware

On mobile, the game uses one vertical flow: compact top HUD, board, Shelf, and transient overlay. On desktop, the page remains full-width but centers a proportioned mobile-game canvas within quiet negative space; it does not reintroduce the current side-rule dashboard as a permanent desktop module.

The board grid stays logical and responsive. Cell size derives from available canvas width, not device pixels, so the same `BoardCoord` and command mapping work on every viewport.

**Alternative rejected:** a fixed phone mockup or a desktop dashboard with side panels. The first is too restrictive for direct browser play; the second conflicts with the reference's focused game composition.

### 3. Treat motion as state feedback, not decoration

Use CSS transitions on `transform`, `opacity`, `filter`, and bounded shadow changes only. Selection lifts gems by a small vertical transform; a successful placement settles it; locked state fades/saturates down; invalid commands use a brief localized nudge; Shelf compaction uses a short positional transition where the DOM layout permits it.

All motion must be disabled or nearly instantaneous under `prefers-reduced-motion`. The reducer emits events and rejection codes; React maps those outputs to visual state classes and accessible status text without inventing timing-dependent game state.

**Alternative rejected:** long bounce sequences, continuous floating, or JavaScript animation loops. They make the result feel theatrical and can desynchronize perception from deterministic replay.

### 4. Keep controls native, sparse, and touch-sized

The HUD has only level identity, reset, and the minimal status needed to play. The Shelf remains a tactile row of inset slots and exposes visible buffer action/cancel controls only when they are actionable.

Interactive targets have at least 44 CSS-pixel hit areas where layout permits, visible keyboard focus, and accessible labels. Text explains the next legal action instead of exposing implementation vocabulary.

### 5. Preserve React as a presentation adapter

No visual effect writes board/Shelf/selection state directly. The app continues to derive presentation from `GameState`, `GameEvent`, and `Rejection`; visual state classes are ephemeral and resettable.

**Alternative rejected:** moving hit testing or animation progression into a Canvas/game loop. That would make Harness/UI equivalence harder to inspect and test.

## Risks / Trade-offs

- **[Reference similarity can become visual copying]** → Reuse material principles only; create all shapes, icons, tokens, copy, and CSS internally.
- **[Light palette can reduce gem contrast]** → Test board states in grayscale and retain dark cell seams, locked desaturation, and focus outlines.
- **[Responsive grid can make Shelf controls cramped]** → Recompose mobile into a vertical flow; hide non-actionable controls rather than shrinking hit targets.
- **[Motion can obscure state or hurt accessibility]** → Use short composited transitions, semantic status text, and reduced-motion overrides.
- **[Visual refactor can accidentally change commands]** → Preserve existing E2E flow, test IDs, reducer imports, and canonical Harness replay before and after styling work.

## Migration Plan

1. Add visual tokens and light canvas composition behind unchanged React command wiring.
2. Refine board, gem, Shelf, HUD, and overlay components in that order.
3. Add interaction-state classes driven only by reducer events/rejections.
4. Verify desktop and mobile screenshots, browser winning flow, Harness replay, typecheck, and static build.
5. Release the changed static `dist/` artifact through the existing CI artifact path. Rollback is a normal static release rollback to the previous artifact/commit; no data migration exists.

## Open Questions

None for the baseline. Exact server-side CD remains intentionally outside this change and will follow the deployment constraints supplied by the repository owner.
