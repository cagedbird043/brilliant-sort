## Context

The current game is a Bun/TypeScript web project with a deterministic gameplay core and a static deployment path. Visual work produced a legitimate `32×32` RGBA cyan gem: it has binary transparency, a stable 29×29 opaque silhouette, a deep navy outline, a white specular highlight, and a deliberately small palette. A manual experiment proved that exact palette replacement can produce coherent ice, navy, coral, and jade variants without changing one pixel of geometry.

That experiment must become a repeatable project capability rather than remain an ad-hoc Python notebook, browser edit, CSS `hue-rotate()` filter, or externally hosted generator workflow. The owner explicitly selected Bun/TypeScript and rejects Python/Rust for this project tool.

## Goals / Non-Goals

**Goals:**

- Provide a project-local, deterministic CLI that derives named pixel-art variants from a reviewed PNG master.
- Treat source colors as semantic roles, preserving geometry, alpha, fixed outline color, and fixed specular color exactly.
- Reject source images whose opaque pixels cannot be explained by the declared palette manifest.
- Generate a self-contained visual-review HTML page that presents derived sprites at a pixelated integer scale.
- Keep the tool runnable through Bun and usable outside an OMP session.
- Add a thin project-local Skill that invokes the CLI and enforces the review gate.

**Non-Goals:**

- Calling an AI image API, storing model credentials, generating artwork, or replacing human art review.
- A Photoshop-like editor, sprite animation generator, automatic background removal, alpha repair, arbitrary hue rotation, or generic image-processing suite.
- Atlas packing, game renderer integration, changes to LevelSpec/reducer behavior, or changes to deployed game presentation in v1.
- Rust, Go, C++, Python, native addon builds, or a background service.

## Decisions

### 1. Implement a Bun/TypeScript CLI using direct RGBA access

The CLI lives in the existing Bun/TypeScript repository and is exposed through a package script. It uses strict TypeScript, Bun's runtime/test runner, Node-compatible filesystem APIs, and the small MIT-licensed `pngjs` decoder/encoder for direct RGBA bytes.

Bun's native image pipeline remains useful for future metadata, format, and nearest-neighbor operations, but semantic role substitution requires raw pixel access. A dedicated PNG decoder is lower risk than attempting to parse PNG scanlines in project code, while a native image stack or a second language would add build and distribution complexity without meaningful benefit for tiny offline sprites.

**Alternatives rejected:**

- **CSS `filter: hue-rotate()`** — transforms the navy outline and cannot encode target-specific lightness/saturation ramps.
- **Python/Pillow** — conflicts with the project's runtime decision and creates a second toolchain.
- **Rust/Go/C++** — viable for a standalone system utility, but over-engineered for a repository-local Bun tool.
- **`sharp`** — powerful but unnecessary native dependency surface for exact small-palette PNG substitution.

### 2. Use a versioned semantic palette manifest

A manifest names every opaque source color by role and declares each target variant. The source master is passed as a CLI argument; the manifest never relies on color order or an inferred hue.

```json
{
  "version": 1,
  "roles": {
    "outline": { "source": "#021951", "fixed": true },
    "mainFacet": { "source": "#03C5FE" },
    "specular": { "source": "#FDFDFD", "fixed": true }
  },
  "variants": {
    "ice": { "mainFacet": "#03C5FE" },
    "coral": { "mainFacet": "#FF7059" }
  }
}
```

`derive` resolves every source opaque RGB pixel to one declared role. For a fixed role, a variant may not override the source color. For a non-fixed role, every variant must provide an explicit replacement. Unrecognized opaque colors, duplicate source colors, malformed hex, missing role assignments, or unknown variant role names fail with actionable diagnostics.

This captures the actual art contract: same silhouette and lighting structure, deliberately different hue/value ramps. It is more precise than a global color-space transformation and works for arbitrary pixel-art masters that have a finite declared palette.

### 3. Keep the first CLI surface small and composable

```text
pixel-bloom inspect <source.png> [--json]
pixel-bloom derive --source <source.png> --palette <palette.json> --out <directory>
pixel-bloom preview --sprites <directory> --out <preview.html>
```

`inspect` reports format, dimensions, alpha statistics, opaque bounds, and sorted opaque colors. `derive` writes one `<variant>.png` for every manifest variant, preserving image dimensions and every input alpha byte. `preview` discovers PNGs in a supplied directory and writes a standalone HTML document with pixelated image rendering, source dimensions, filenames, and no remote dependencies.

`derive` does not infer roles, crop sprites, resize output, create animation, or pack an atlas. Those concerns remain deliberately deferred until a real second fixture needs them.

### 4. Encode visual invariants as automated tests

Focused Bun tests create a tiny RGBA fixture through the PNG encoder and assert that:

- `inspect` distinguishes true transparency from an opaque checkerboard/background image.
- `derive` emits every declared variant, preserves dimensions and alpha byte-for-byte, and keeps fixed roles unchanged.
- Variant ramps replace only the declared non-fixed source colors.
- An undeclared opaque source color fails derivation instead of silently leaking into output.
- `preview` writes a local review page that lists each sprite and uses pixelated image rendering.

A browser smoke test opens a generated preview file at desktop and mobile widths to confirm every derived sprite is visible and no horizontal overflow exists.

### 5. Add a thin project-local Skill after the CLI contract exists

The repository-local Skill lives at `.agents/skills/pixel-asset-pipeline/SKILL.md`. It is intentionally passive workflow knowledge, not a duplicate image implementation. It directs an agent to:

1. Keep unreviewed AI output in `art/inbox/`.
2. Run `inspect` before treating any PNG as a master.
3. Require explicit manifest roles before deriving variants.
4. Run `derive` and `preview`.
5. Review actual output before copying approved files into any game-consumed asset location.

A global OMP skill is out of scope. The repository-local Skill is versioned beside the CLI and does not alter `~/.omp/agent/` runtime files.

## Risks / Trade-offs

- **[AI source files may contain fake transparency or hidden palette noise]** → `inspect` exposes Alpha and colors; `derive` rejects undeclared opaque pixels.
- **[Strict palette validation may reject a visually useful source]** → this is intentional for v1; a human should normalize or revise the manifest rather than silently ship unexplained pixels.
- **[Palette swaps can make semantic colors too similar]** → browser review is mandatory; manifest ramps are reviewable data, not implicit math.
- **[A helper CLI may become an oversized image editor]** → v1 limits itself to inspect, exact palette derivation, and preview.
- **[Project-local Skill may diverge from CLI]** → the Skill only orchestrates documented commands and contains no transformation rules.

## Migration Plan

1. Add the CLI, manifest schema, test fixture generation, and project-local Skill without touching gameplay presentation.
2. Run the CLI against the reviewed cyan source inside `art/inbox/` to produce only review artifacts.
3. Compare generated variants in a browser at desktop and mobile widths.
4. Approve the manifest only after human visual review; later visual work may copy approved assets into a game-consumed location.
5. Rollback is deletion of the new tool and review artifacts; it has no persisted game state, network deployment, or data migration.

## Open Questions

None for v1. Atlas packing, animation frame support, and non-binary-alpha assets will be evaluated only after a second real asset family demonstrates a need.
