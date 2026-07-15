# Brilliant Sort

A deterministic, playable web slice of a Brilliant Sort-style gem puzzle. The browser drives a headless C++20 `BrilliantSortCore` compiled to WebAssembly; the original TypeScript reducer remains only as a differential-test oracle.

Live demos: <https://cagedbird043.github.io/brilliant-sort/> · <https://brilliant-sort.cagedbird.cn/>

## What is implemented

- Fixed, versioned JSON puzzle fixtures.
- Same-color movable eight-neighbor component selection.
- Safe boundary extraction that keeps partially moved selections connected.
- Matching target-component placement and compact twelve-column Shelf storage.
- Deterministic victory state, canonical replay, browser E2E, and byte-exact TypeScript ↔ native C++ ↔ WebAssembly differential verification.

Commercial power-ups, payment, random generation, random mode, and progression are intentionally deferred. See [`openspec/`](./openspec/) for the evidence boundary and acceptance contracts.

## Run locally

```bash
bun install

# One local, ignored Emscripten 6.0.3 toolchain setup.
git clone --depth 1 --branch 6.0.3 https://github.com/emscripten-core/emsdk.git .cache/emsdk
.cache/emsdk/emsdk install 6.0.3
.cache/emsdk/emsdk activate 6.0.3

bun run dev
```

Open the Vite URL printed by the command. `bun run dev` builds the local WASM core before starting Vite. The production app is static:

```bash
bun run build
```

## Deployments

`main` continues to publish the GitHub Pages build at `/brilliant-sort/`. After the same verification job passes, `publish-hk` downloads a separate root-based static artifact, rsyncs it to an immutable release under `/srv/cagedbird/brilliant-sort/releases/<sha>`, and atomically switches Caddy's `current` symlink for <https://brilliant-sort.cagedbird.cn/>.

The Hong Kong job uses the repository secret `HK_EDGE_DEPLOY_KEY`, a pinned SSH host key, and a restricted remote key without shell forwarding. Caddy serves the site directly with compressed responses, immutable hashed assets, and uncached HTML; no origin application process or reverse proxy is needed for this static WASM game.

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
bun run test:cpp
bun run test:wasm
bun run test:differential
bun run test:e2e
```

`bun run check` runs typechecking, native C++ tests, WASM build, TypeScript/WASM/native differential tests, and a Vite production build. Browser E2E requires Chromium installed through Playwright:

```bash
bunx playwright install chromium
```

Replay the fixed trace through the production WASM core, or run the three-backend Harness gate:

```bash
bun run harness replay prism-01
bun run harness differential prism-01
```


## Architecture

```text
cpp/            C++20 BrilliantSortCore, C ABI, CMake targets, and component exercise
src/core/       Versioned state types, dump format, and TypeScript differential oracle
src/wasm/       Emscripten module declaration and GameCorePort adapter
src/fixtures/   Fixed JSON LevelSpec content and replay traces
src/app/        React workbench presentation, accessibility, and motion
src/harness/    GameCorePort replay, native/WASM differential diagnostics, and CLI
src/assets/     Promoted locked pixel sprites consumed by the browser bundle
src/agent/      Constrained agent context and auditable validation records
src/pixel-bloom/ Deterministic PNG inspection, palette derivation, and preview CLI
art/             Candidate inbox, versioned palette manifests, and review artifacts
.agents/skills/  Project-local agent workflows
openspec/       Product rules, design, requirements, and task contracts
```

The deployed artifact is `dist/`; production does not require a Bun daemon or backend service.

## License

[MIT](./LICENSE)
