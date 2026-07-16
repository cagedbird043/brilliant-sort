<a id="english"></a>

# Brilliant Sort

**[English](#english)** · [简体中文](#zh-cn)

A deterministic, playable web slice of a Brilliant Sort-style gem puzzle. The browser drives a headless C++20 `BrilliantSortCore` compiled to WebAssembly; the original TypeScript reducer remains only as a differential-test oracle.

Live demos: <https://cagedbird043.github.io/brilliant-sort/> · <https://brilliant-sort.cagedbird.cn/>

Assessment submission: [`SUBMISSION.md`](./SUBMISSION.md) · [`PDF`](./submission/Brilliant-Sort-Answer.pdf) · [`Evidence matrix`](./submission/evidence-matrix.md)

## What is implemented

- The compiled 24×32 `tux-01` flagship fixture: 546 active sockets, a deterministic 75.09% locked opening, and a sixteen-slot Shelf.
- Same-color movable eight-neighbor component selection with connectivity-preserving partial extraction.
- Matching target-component placement, compact configured Shelf storage, and ordered two-bank presentation.
- Responsive desktop/square/portrait Tux staging with integer fit, bounded zoom/pan, authoritative WAAPI flight, and a solved-image shimmer.
- A separate deterministic C++20 pixel-audio engine compiled to AudioWorklet WASM, with gameplay cues, first-gesture resume, persisted in-world mute, and silent failure fallback.
- Canonical replay, browser E2E, and byte-exact TypeScript ↔ native C++ ↔ WebAssembly differential verification.

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

Open the Vite URL printed by the command. `bun run dev` builds the game-core and pixel-audio WASM modules before starting Vite. The production app is static:

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

## Flagship fixture and pixel audio

The reviewed compact map at `src/fixtures/source/tux-01.map.json` is the authoring source for the canonical `LevelSpec`; `prism-01` remains a focused regression fixture. The committed Tux trace wins identically in the TypeScript oracle, native C++ core, and production WASM core.

```bash
bun run level:compile:tux
bun run level:check:tux
bun run harness replay tux-01
bun run harness differential tux-01
```

Pixel music and effects are synthesized by `cpp/audio/` from the constrained score in `src/audio/tux-01.music.json`. The browser loads the raw standalone audio WASM only through an `AudioWorklet`; no PCM or tracker asset is shipped.

```bash
bun run build:cpp
.cache/cmake/pixel_audio_offline_renderer --seconds 8
```

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

Replay the flagship fixed trace through the production WASM core, or run the three-backend Harness gate:

```bash
bun run harness replay tux-01
bun run harness differential tux-01
```

Use `prism-01` with the same commands for the compact regression fixture.


## Architecture

```text
cpp/             C++20 BrilliantSortCore, C ABI, CMake targets, and component exercise
cpp/audio/       Fixed-capacity pixel synth, constrained Tux score, worklet ABI, and offline renderer
src/core/        Versioned state types, dump format, and TypeScript differential oracle
src/wasm/        Emscripten module declaration and GameCorePort adapter
src/audio/       Cue bridge, persisted browser port, AudioWorklet processor, score, and audio WASM
src/fixtures/    Compact Tux authoring map, generated LevelSpec fixtures, and replay traces
src/app/         React Tux stage, adaptive camera, accessibility, and authoritative motion
src/harness/     GameCorePort replay, native/WASM differential diagnostics, and CLI
src/assets/      Promoted large and Micro pixel families consumed by the browser bundle
src/agent/       Constrained agent context and auditable validation records
src/pixel-bloom/ Deterministic PNG inspection, palette derivation, and preview CLI
tools/           Deterministic compact-map compiler
art/             Candidate inbox, versioned palette manifests, and review artifacts
.agents/skills/  Project-local agent workflows
openspec/        Product rules, design, requirements, and task contracts
```

The deployed artifact is `dist/`; production does not require a Bun daemon or backend service.

## License

[MIT](./LICENSE)

---

<a id="zh-cn"></a>

# Brilliant Sort

[English](#english) · **[简体中文](#zh-cn)**

一个确定性的 Brilliant Sort 宝石拼图核心、Harness 与可在线游玩的 Web Demo。浏览器通过 WebAssembly 驱动无头 C++20 `BrilliantSortCore`；原始 TypeScript reducer 仅保留为独立差分 Oracle。

在线试玩：[GitHub Pages](https://cagedbird043.github.io/brilliant-sort/) · [Hong Kong 生产站](https://brilliant-sort.cagedbird.cn/)

笔试材料：[`SUBMISSION.md`](./SUBMISSION.md) · [`PDF`](./submission/Brilliant-Sort-Answer.pdf) · [`需求证据矩阵`](./submission/evidence-matrix.md)

## 已实现内容

- 编译后的 24×32 `tux-01` 旗舰关卡：546 个有效 Socket、确定性的 75.09% 初始锁定比例和 16 槽 Shelf。
- 同色可移动宝石的八方向连通选择，以及保持剩余组件连通的安全部分提取。
- 匹配目标组件放置、紧凑且可配置容量的 Shelf 存储，以及有序的双 Bank 表现。
- 自适应桌面/方屏/竖屏 Tux 舞台：整数尺寸拟合、受限缩放/平移、权威 WAAPI 飞行和通关像素扫光。
- 独立的确定性 C++20 像素音频引擎，编译到 AudioWorklet WASM，支持玩法 Cue、首次交互恢复、场景内静音持久化和静默失败降级。
- Canonical replay、浏览器 E2E，以及 TypeScript ↔ 原生 C++ ↔ WebAssembly 的逐字节差分验证。

商业 Power-up、付费、运行时随机生成、随机模式和进度系统均被明确延后。证据边界和验收契约见 [`openspec/`](./openspec/)。

## 本地运行

```bash
bun install

# 一份本地、被 Git 忽略的 Emscripten 6.0.3 工具链。
git clone --depth 1 --branch 6.0.3 https://github.com/emscripten-core/emsdk.git .cache/emsdk
.cache/emsdk/emsdk install 6.0.3
.cache/emsdk/emsdk activate 6.0.3

bun run dev
```

打开命令打印出的 Vite URL。`bun run dev` 会先构建游戏核心和像素音频 WASM，再启动 Vite。生产产物为静态文件：

```bash
bun run build
```

## 部署

`main` 会持续发布 GitHub Pages 构建到 `/brilliant-sort/`。同一验证任务成功后，`publish-hk` 下载独立的根路径静态产物，rsync 到 `/srv/cagedbird/brilliant-sort/releases/<sha>` 下的不可变发布目录，并原子切换 Caddy 的 `current` 符号链接，服务于 <https://brilliant-sort.cagedbird.cn/>。

香港发布任务使用仓库 Secret `HK_EDGE_DEPLOY_KEY`、固定 SSH 主机密钥和禁止 shell forwarding 的受限远端密钥。Caddy 直接提供压缩响应、不可变哈希资源和无缓存 HTML；这个静态 WASM 游戏不需要源站应用进程或反向代理。

## 像素资源管线

`pixel-bloom` 将一个经过评审的像素 PNG 主素材派生为经验证的语义调色板变体。它通过 Bun 在本地运行；源图获批后不需要 AI API、服务或图像编辑器。

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

CLI 会拒绝伪透明、v1 源图中的半透明像素，以及未声明的不透明调色板噪声。项目内的 [`pixel-asset-pipeline`](./.agents/skills/pixel-asset-pipeline/SKILL.md) 流程要求 `inspect → derive → preview → 人工批准` 后，才能把资源提升到游戏消费目录。

## 旗舰关卡与像素音频

已评审的紧凑地图 [`src/fixtures/source/tux-01.map.json`](./src/fixtures/source/tux-01.map.json) 是 canonical `LevelSpec` 的作者输入；`prism-01` 保留为聚焦回归夹具。提交的 Tux 轨迹会在 TypeScript Oracle、原生 C++ 核心和生产 WASM 核心中完全相同地胜利。

```bash
bun run level:compile:tux
bun run level:check:tux
bun run harness replay tux-01
bun run harness differential tux-01
```

像素音乐和效果由 `cpp/audio/` 根据受约束的 [`src/audio/tux-01.music.json`](./src/audio/tux-01.music.json) 合成。浏览器只通过 `AudioWorklet` 加载原始的独立音频 WASM；不携带 PCM 或 tracker 资源。

```bash
bun run build:cpp
.cache/cmake/pixel_audio_offline_renderer --seconds 8
```

## 验证

```bash
bun run typecheck
bun run test:cpp
bun run test:wasm
bun run test:differential
bun run test:e2e
```

`bun run check` 会运行类型检查、原生 C++ 测试、WASM 构建、TypeScript/WASM/原生差分测试和 Vite 生产构建。浏览器 E2E 需要通过 Playwright 安装 Chromium：

```bash
bunx playwright install chromium
```

可以通过生产 WASM 核心回放旗舰固定轨迹，或运行三后端 Harness 门禁：

```bash
bun run harness replay tux-01
bun run harness differential tux-01
```

对紧凑回归夹具使用相同命令并将 `tux-01` 替换为 `prism-01`。

## 架构

```text
cpp/             C++20 BrilliantSortCore、C ABI、CMake target 与连通分量练习
cpp/audio/       固定容量像素合成器、受约束 Tux 乐曲、Worklet ABI 与离线渲染器
src/core/        版本化状态类型、dump 格式和 TypeScript 差分 Oracle
src/wasm/        Emscripten 模块声明和 GameCorePort 适配器
src/audio/       Cue 桥、持久化浏览器端口、AudioWorklet 处理器、乐曲和音频 WASM
src/fixtures/    紧凑 Tux 作者地图、生成的 LevelSpec 夹具和回放轨迹
src/app/         React Tux 舞台、自适应相机、无障碍与权威动画
src/harness/     GameCorePort 回放、native/WASM 差分诊断和 CLI
src/assets/      浏览器 Bundle 消费的已提升 Large 与 Micro 像素资源家族
src/agent/       受约束的 Agent 上下文和可审计验证记录
src/pixel-bloom/ 确定性 PNG 检查、调色板派生和预览 CLI
tools/           确定性紧凑地图编译器
art/             候选 inbox、版本化调色板 manifest 和评审产物
.agents/skills/  项目内 Agent 工作流
openspec/        产品规则、设计、需求和任务契约
```

部署产物为 `dist/`；生产环境不需要 Bun daemon 或后端服务。

## 许可证

[MIT](./LICENSE)
