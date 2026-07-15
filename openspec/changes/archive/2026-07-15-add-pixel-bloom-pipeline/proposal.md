## Why

A reviewed pixel-art master sprite should not require repeated AI generations, manual Photoshop recoloring, or hand-cutting before it can become a coherent game asset family. Brilliant Sort now has a genuine `32×32` RGBA cyan crystal candidate whose fixed silhouette, binary alpha mask, outline, and highlights can deterministically produce the other fixture colors.

The project needs a small, reproducible pipeline that turns a source sprite plus an explicit semantic palette manifest into validated PNG variants and a browser-reviewable preview. This makes AI an upstream candidate generator while keeping final production assets deterministic, inspectable, and usable without an AI service or credentials.

## What Changes

- Add a Bun/TypeScript `pixel-bloom` CLI with `inspect`, `derive`, and `preview` commands.
- Define a versioned semantic palette manifest for exact source-color-to-role mapping and named target variants.
- Preserve a source sprite's dimensions, alpha values, and pixel geometry during derivation; fixed roles such as outline and specular highlight remain unchanged across variants.
- Add strict validation that rejects opaque source colors absent from the manifest instead of silently applying a global hue rotation.
- Add a project-local `pixel-asset-pipeline` Skill that drives the CLI through inspect → derive → preview → human review, without embedding image-processing logic in prompts.
- Add focused Bun tests and a browser smoke review for generated preview output.

## Capabilities

### New Capabilities

- `pixel-asset-pipeline`: Deterministic inspection, semantic palette derivation, validation, and preview of pixel-art asset families.

### Modified Capabilities

- None.

## Impact

Affected areas are `package.json`, a new Bun/TypeScript CLI module, focused tests, project-owned palette manifests under `art/`, generated review artifacts, and `.agents/skills/`. The deterministic puzzle core, LevelSpec, gameplay reducer, Harness, C++ exercise, existing game presentation, GitHub Pages deployment, and any external AI image generator remain unchanged.
