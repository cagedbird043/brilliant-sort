---
name: pixel-asset-pipeline
description: Inspect, derive, validate, and review Brilliant Sort pixel-art PNG asset families. Use this skill whenever a user provides or asks to generate a pixel sprite, requests recolors/variants, mentions sprite sheets or transparent game assets, or wants to promote an AI-generated pixel candidate into the Brilliant Sort game. Trigger even when the request only asks for one additional color, background transparency validation, or a visual sprite preview.
---

# Pixel Asset Pipeline

Treat AI image tools as sources of candidate master sprites, never as the runtime asset pipeline. The repository's `pixel-bloom` Bun CLI is the authority for inspecting, deriving, and previewing asset families.

## Asset lifecycle

```text
candidate PNG in art/inbox/
  → inspect
  → semantic palette manifest
  → derive
  → local browser preview
  → human approval
  → explicit promotion into a game-consumed asset path
```

Do not skip a stage. Keep all unreviewed candidates under `art/inbox/`; do not copy them into `src/`, `public/`, or another game-consumed path before a human approves the derived family.

## Required checks

Run this before treating a PNG as a master:

```bash
bun run pixel-bloom inspect <candidate.png> --json
```

A v1 master must be a readable PNG with intentional transparent pixels, a finite opaque palette, and binary Alpha only (`0` or `255`). A rendered white background or checkerboard is opaque image content, not transparency. Reject or regenerate candidates with fake transparency, accidental opaque palette noise, inconsistent geometry, or semi-transparent edge blur.

## Deriving variants

Use an explicit semantic palette manifest. Do not use CSS `hue-rotate()`, global color filters, manual Photoshop recoloring, or a second independent AI generation for each color when a validated master already exists.

```bash
bun run pixel-bloom derive \
  --source <candidate.png> \
  --palette art/palettes/brilliant-sort.json \
  --out art/review/pixel-bloom/gems
```

The manifest locks structural colors such as `outline` and `specular`; it maps non-fixed facet roles to named game variants. `pixel-bloom` fails closed if the source has an opaque color absent from the manifest, a translucent pixel, or an invalid fixed-role override. Fix the source or manifest rather than bypassing the error.

## Review output

Always generate and inspect a local review page after derivation:

```bash
bun run pixel-bloom preview \
  --sprites art/review/pixel-bloom/gems \
  --out art/review/pixel-bloom/index.html
```

Open the generated file in a browser at desktop and approximately 390 CSS-pixel mobile width. Confirm every variant remains distinguishable, source geometry and Alpha masks match, structural outline/highlight roles stay stable, and no horizontal overflow occurs.

## Promotion gate

Report the inspection facts, generated file paths, and browser result to the user. Only after explicit visual approval may an asset family be moved or copied into a game-consumed asset directory and wired into the React presentation. Do not add decorative non-functional economy, power-up, lock, or commercial UI assets.
