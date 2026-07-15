# Brilliant Sort

A deterministic, playable web slice of a Brilliant Sort-style gem puzzle. The project is designed as an engineering assessment artifact: the same TypeScript reducer drives the React UI, fixture replay, Harness diagnostics, and core tests.

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
openspec/       Product rules, design, requirements, and task contracts
```

The deployed artifact is `dist/`; production does not require a Bun daemon or backend service.

## License

[MIT](./LICENSE)
