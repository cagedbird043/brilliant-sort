# Brilliant Sort

A deterministic, playable web slice of a Brilliant Sort-style gem puzzle. The project is designed as an engineering assessment artifact: the same TypeScript reducer drives the React UI, fixture replay, Harness diagnostics, and core tests.

Live demo: <https://cagedbird043.github.io/brilliant-sort/>

## What is implemented

- Fixed, versioned JSON puzzle fixtures.
- Same-color movable eight-neighbor component selection.
- Safe boundary extraction that keeps partially moved selections connected.
- Matching target-component placement and compact twelve-column Shelf storage.
- Deterministic victory state, canonical replay, browser E2E, and an independent C++ connected-component exercise.

Commercial power-ups, payment, random generation, random mode, and progression are intentionally deferred. See [`openspec/`](./openspec/) for the evidence boundary and acceptance contracts.

## Run locally

```bash
bun install
bun run dev
```

Open the Vite URL printed by the command. The production app is static:

```bash
bun run build
```

## Pixel asset pipeline

`pixel-bloom` turns one reviewed pixel-art PNG master into a validated family of semantic palette variants. It runs locally with Bun; no AI API, service, or image editor is required after the source art has been approved.

```bash
bun run pixel-bloom inspect art/inbox/<master>.png --json
bun run pixel-bloom derive \
  --source art/inbox/<master>.png \
  --palette art/palettes/brilliant-sort.json \
  --out art/review/pixel-bloom/gems
bun run pixel-bloom preview \
  --sprites art/review/pixel-bloom/gems \
  --out art/review/pixel-bloom/index.html
```

The CLI rejects fake transparency, translucent v1 source pixels, and undeclared opaque palette noise. The project-local [`pixel-asset-pipeline`](./.agents/skills/pixel-asset-pipeline/SKILL.md) workflow requires inspect → derive → preview → human approval before art is promoted into the game.

## Verify

```bash
bun run typecheck
bun test
bun run test:cpp
bun run build
bun run test:e2e
```

`bun run check` runs the non-browser verification and production build. Browser E2E requires Chromium installed through Playwright:

```bash
bunx playwright install chromium
```

Replay the committed winning trace through the same production reducer:

```bash
bun run harness replay prism-01
```


## Architecture

```text
src/core/       Pure TypeScript game state, topology, reducer, invariants
src/fixtures/   Fixed JSON LevelSpec content and replay traces
src/app/        React presentation adapter
src/harness/    Replay, dump, diff, fixture diagnostics, and CLI
src/agent/      Constrained agent context and auditable validation records
cpp/            Independent C++ FindConnectedMovableGems exercise
src/pixel-bloom/ Deterministic PNG inspection, palette derivation, and preview CLI
art/             Candidate inbox, versioned palette manifests, and review artifacts
.agents/skills/  Project-local agent workflows
openspec/       Product rules, design, requirements, and task contracts
```

The deployed artifact is `dist/`; production does not require a Bun daemon or backend service.

## License

[MIT](./LICENSE)
