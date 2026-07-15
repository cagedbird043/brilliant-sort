# pixel-asset-pipeline Specification

## Purpose
TBD - created by archiving change add-pixel-bloom-pipeline. Update Purpose after archive.
## Requirements
### Requirement: The project SHALL provide a Bun-runnable pixel asset CLI

The repository SHALL expose a Bun/TypeScript `pixel-bloom` command with `inspect`, `derive`, and `preview` subcommands. The command SHALL operate locally on project files and SHALL not require an AI API, network request, service process, Python runtime, or non-Bun language toolchain.

#### Scenario: Inspecting a candidate source sprite

- **WHEN** a user invokes `pixel-bloom inspect` on a readable PNG file
- **THEN** the command reports the image dimensions, Alpha statistics, opaque bounds, and opaque RGB palette
- **AND THEN** it reports whether transparent pixels exist without treating a rendered checkerboard as transparency.

#### Scenario: Running outside an OMP session

- **WHEN** a developer invokes the documented package command from the repository checkout
- **THEN** the CLI completes using Bun and local project dependencies
- **AND THEN** no agent Skill, remote image generator, credential, or running server is required.

### Requirement: Derivation SHALL use explicit semantic palette mapping

`pixel-bloom derive` SHALL accept a PNG source, a versioned JSON palette manifest, and an output directory. The manifest SHALL declare each opaque source RGB color as a named role and SHALL declare named target variants with explicit replacement colors for non-fixed roles.

The CLI SHALL not use global hue rotation or infer color roles from source ordering. It SHALL preserve source dimensions and every source Alpha byte exactly in every derived variant. V1 SHALL accept only binary Alpha values (`0` or `255`) and SHALL reject translucent source pixels.

#### Scenario: Deriving a named color family

- **WHEN** a valid master sprite and valid manifest declare `ice`, `navy`, `coral`, and `jade` variants
- **THEN** `derive` writes one PNG for each variant into the requested directory
- **AND THEN** each output has the same dimensions and Alpha mask as the master
- **AND THEN** every declared source pixel is replaced according to its semantic role.

#### Scenario: Rejecting translucent source pixels

- **WHEN** a source sprite contains an Alpha value strictly between `0` and `255`
- **THEN** `derive` fails before writing a successful variant set
- **AND THEN** the diagnostic identifies binary Alpha as the v1 source requirement.

#### Scenario: Preserving structural pixel roles

- **WHEN** a manifest declares outline and specular roles as fixed
- **THEN** those source RGB values remain identical in every derived variant
- **AND THEN** only declared non-fixed facet roles receive variant-specific colors.

### Requirement: Derivation SHALL fail closed on unexplained source pixels

A derivation SHALL fail with a non-zero result and actionable diagnostic if any opaque source pixel does not map to a manifest role, if any source pixel has translucent Alpha, if source roles duplicate an RGB color, if a variant lacks a required non-fixed role, or if a variant overrides a fixed role.

#### Scenario: Rejecting hidden palette noise

- **WHEN** a master sprite contains an opaque RGB pixel absent from the manifest
- **THEN** `derive` fails before writing a successful variant set
- **AND THEN** the diagnostic identifies the unexplained color.

#### Scenario: Rejecting an illegal fixed-color override

- **WHEN** a target variant supplies a replacement for a fixed outline or specular role
- **THEN** `derive` fails with a diagnostic naming that role
- **AND THEN** no output claims to be a valid derived family.

### Requirement: The CLI SHALL generate local visual review output

`pixel-bloom preview` SHALL consume a directory of generated PNG sprites and write a standalone HTML review page. The page SHALL list each included sprite, preserve local-only asset references, and render sprites with pixelated image scaling.

#### Scenario: Reviewing a derived family in a browser

- **WHEN** a developer runs `pixel-bloom preview` after a successful derivation
- **THEN** the generated HTML displays every derived sprite with its filename and source dimensions
- **AND THEN** it can be opened from the local filesystem without remote assets or a server.

#### Scenario: Viewing on a narrow viewport

- **WHEN** the generated preview is opened at approximately 390 CSS pixels wide
- **THEN** every included sprite remains visible
- **AND THEN** the page has no horizontal overflow.

### Requirement: The repository SHALL provide a thin project-local asset workflow Skill

The repository SHALL contain `.agents/skills/pixel-asset-pipeline/SKILL.md` with meaningful trigger metadata and a workflow that invokes `pixel-bloom` rather than reimplementing PNG transformations in prompts. The Skill SHALL keep unreviewed candidates in `art/inbox/` and require inspect, derive, preview, and human review before any candidate is treated as game-consumed art.

#### Scenario: Receiving a new AI-generated pixel candidate

- **WHEN** an agent receives a candidate sprite for Brilliant Sort
- **THEN** the project Skill directs it to inspect the original PNG before deriving variants
- **AND THEN** it prevents the candidate from being copied into a production game-asset path until the derived preview is reviewed.

