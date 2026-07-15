## 1. Contract and command surface

- [x] 1.1 Add the `pixel-bloom` Bun package script and a versioned Brilliant Sort palette manifest.
- [x] 1.2 Define strict TypeScript types and validation for role-based source colors, fixed roles, variants, CLI arguments, and diagnostics.
- [x] 1.3 Implement `inspect` reporting for PNG metadata, Alpha statistics, opaque bounds, and opaque palette colors.

## 2. Deterministic derivation

- [x] 2.1 Implement exact source-color role lookup and per-variant palette replacement using RGBA PNG bytes.
- [x] 2.2 Preserve dimensions and every Alpha byte; reject undeclared opaque colors, malformed manifests, duplicate source colors, and illegal fixed-role overrides.
- [x] 2.3 Write one deterministic PNG per declared variant with stable naming and output-directory creation.

## 3. Review workflow

- [x] 3.1 Implement standalone local HTML preview generation for a directory of PNG sprites using pixelated rendering.
- [x] 3.2 Add `.agents/skills/pixel-asset-pipeline/SKILL.md` as a thin inspect → derive → preview → human-review workflow wrapper.
- [x] 3.3 Keep generated inbox/review artifacts separate from game-consumed assets until explicit approval.

## 4. Verification

- [x] 4.1 Add focused Bun tests for valid derivation, invariant Alpha mask, fixed colors, strict rejection, and preview output.
- [x] 4.2 Run the CLI against the reviewed cyan input to create and inspect all four Brilliant Sort color variants.
- [x] 4.3 Open generated output in desktop and mobile browser viewports; confirm all variants are visible and no horizontal overflow occurs.
- [x] 4.4 Run typecheck, focused/full Bun tests, C++ tests, static build, and strict OpenSpec validation.
