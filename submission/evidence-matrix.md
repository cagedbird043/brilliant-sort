# Brilliant Sort 笔试要求 → 可审计证据矩阵

本附录配合根目录 [`SUBMISSION.md`](../SUBMISSION.md) 阅读。所有链接均指向同一仓库、同一提交历史中的源码、归档规格或自动化证据；它不是测试标题汇总，而是让阅卷者能复查每个结论的来源。

| 题目要求 | 设计/实现结论 | 主要源码 | 自动化或上线证据 |
| --- | --- | --- | --- |
| 不超过 8 行的玩法假设 | 规则事实、延期能力和胜利边界被显式记录；不会把视频未展示的商业规则伪造为事实 | [`SUBMISSION.md#1-玩法假设`](../SUBMISSION.md#1-玩法假设)；[核心归档 proposal](../openspec/changes/archive/2026-07-15-add-brilliant-sort-core/proposal.md) | `tests/core/reducer.test.ts`、固定 fixture 验证 |
| 棋盘、格子、宝石、槽位、颜色、坐标和状态 | `LevelSpec` / `GameState` / `BoardCell` / `Gem` / `Shelf` / `Selection` 是版本化 TypeScript/C++ JSON 协议 | [`src/core/types.ts`](../src/core/types.ts)；[`src/core/level.ts`](../src/core/level.ts)；[`cpp/game_core.hpp`](../cpp/game_core.hpp) | `tests/core/reducer.test.ts`；`cpp/game_core_test.cpp` |
| 模块职责、输入输出与状态所有权 | C++ `BrilliantSortCore` 是生产规则权威；`GameCorePort` 只暴露 load/dispatch/snapshot/restart/destroy；UI 不直接写 state | [`src/core/port.ts`](../src/core/port.ts)；[`cpp/game_core.cpp`](../cpp/game_core.cpp)；[WASM 归档设计](../openspec/changes/archive/2026-07-16-add-pixel-crystal-renderer/design.md) | TypeScript ↔ native C++ ↔ WASM 差分回放 |
| 选择、放置、Shelf、全局修复与胜利流程 | 八方向最大分量、安全边界提取、同色目标批量放置、紧凑 Shelf 压缩、确定性全局身份配对、`Won` 谓词 | [`src/core/topology.ts`](../src/core/topology.ts)；[`src/core/reducer.ts`](../src/core/reducer.ts)；[`cpp/game_core.cpp`](../cpp/game_core.cpp) | `tests/core/reducer.test.ts`；`tests/core/global-wand.test.ts`；`cpp/game_core_test.cpp`；`tux-01.win.json` |
| Demo 一键全局修复 | `apply-global-wand` 保留锁定身份，按颜色将字典序 Gem ID 配对到行优先目标；只发一个聚合事件和一个 `won` | [归档 OpenSpec 设计](../openspec/changes/archive/2026-07-16-add-demo-assist-and-victory-finale/design.md)；[`src/core/types.ts`](../src/core/types.ts)；[`cpp/game_core.cpp`](../cpp/game_core.cpp) | 初始/中途状态 TypeScript、native C++、WASM canonical parity；`tests/core/global-wand.test.ts` |
| 全图飞行、胜利终章、重玩与一次性引导 | 136 个可移动身份由 pre/post 稳定位置派生；终章收尾后，右侧魔法棒换成 contextual replay，dispatch `restart-level` 并用 presentation token 复位相机 | [活动重玩 OpenSpec 设计](../openspec/changes/add-win-replay-control/design.md)；[`src/app/App.tsx`](../src/app/App.tsx)；[`src/app/VictoryFinale.tsx`](../src/app/VictoryFinale.tsx)；[`src/assets/pixel/replay-level.svg`](../src/assets/pixel/replay-level.svg) | 11 个场景 × desktop/mobile Chromium；含手动/魔法棒胜利、键盘重玩、相机复位、偏好保留、存储失败与 reduced-motion |
| 重玩后的第二次成功音乐 | `Restart = 7` 作为 append-only critical Cue，按局清空 Voice/Transport/Layer/胜利锁存但保留 mute；12 字节包与 AudioContext 不变 | [`src/audio/game-cues.ts`](../src/audio/game-cues.ts)；[`cpp/audio/pixel_audio.cpp`](../cpp/audio/pixel_audio.cpp)；[活动重玩音频规格](../openspec/changes/add-win-replay-control/specs/cpp-pixel-audio/spec.md) | TS 断言 `Won → Restart → Won`；native `fanfare_count == 2`；browser Worklet kind `[6,7,6]` |
| UI / 表现 / Cocos 引擎层解耦 | React/DOM 只是表现适配器；C++ Core 不包含 DOM、素材、动画或 ARIA；未来引擎替换消费同一协议 | [`src/app/App.tsx`](../src/app/App.tsx)；[`src/wasm/game-core.ts`](../src/wasm/game-core.ts) | `tests/wasm/game-core.test.ts`；browser E2E |
| 纯逻辑、可驱动、可序列化 Harness 接口 | canonical JSON 稳定排序；每个 command 有 state/events/rejection；Harness 可 replay/diff | [`src/core/dump.ts`](../src/core/dump.ts)；[`src/harness/replay.ts`](../src/harness/replay.ts)；[`src/harness/diff.ts`](../src/harness/diff.ts) | `tests/harness/replay.test.ts` |
| 固定布局 / 固定随机测试场景 | 所有 baseline fixture 都是版本化 JSON；`tux-01` 的紧凑 map 经确定性编译 | [`src/fixtures/source/tux-01.map.json`](../src/fixtures/source/tux-01.map.json)；[`tools/compile-level-map.ts`](../tools/compile-level-map.ts) | `tests/fixtures/level-map.test.ts`；`bun run level:check:tux` |
| 读取棋盘、宝石、槽位、选择、胜利状态 | `snapshot()` 与 `canonicalDump` 完整覆盖 semantic state；不混入像素/对象引用 | [`src/core/port.ts`](../src/core/port.ts)；[`src/core/dump.ts`](../src/core/dump.ts) | WASM/Core replay tests |
| 模拟棋盘 / 空格 / 槽位 / 全局修复 / 重玩操作 | 所有 UI 操作被规范化为 `GameCommand`；魔法棒走 `apply-global-wand`，重玩走既有 `restart-level`，都没有 DOM 侧状态捷径 | [`src/core/types.ts`](../src/core/types.ts)；[`src/app/App.tsx`](../src/app/App.tsx)；[`src/harness/cli.ts`](../src/harness/cli.ts) | `tests/e2e/game.e2e.ts`；`tests/harness/replay.test.ts`；`tests/harness/differential.test.ts` |
| 操作前后 dump 与比较 | `CoreTransition` 捕获 before/after、event 与 rejection；diff 返回首个 JSON 路径 | [`src/harness/differential.ts`](../src/harness/differential.ts) | `tests/harness/differential.test.ts` |
| 必须覆盖的自动化场景 | 对角连通、锁定/异色屏障、Shelf 容量/压缩、拒绝、Tux 完整胜利、全局修复、`Won → Restart → Won` 音频、引导/静音持久化、contextual replay、相机复位、reduced-motion、重放确定性 | [`tests/core/`](../tests/core/)；[`tests/harness/`](../tests/harness/)；[`tests/wasm/`](../tests/wasm/)；[`tests/audio/game-cues.test.ts`](../tests/audio/game-cues.test.ts)；[`tests/e2e/game.e2e.ts`](../tests/e2e/game.e2e.ts) | `bun run check`；`bunx lefthook run pre-push --all-files`；`bun run harness differential tux-01` |
| AI Agent 的正确上下文 | `openspec/config.yaml` 固定项目边界；延期能力直接阻断；官方 OpenSpec 1.6 skills 同步给 Oh My Pi、Codex、Claude Code、OpenCode | [`openspec/config.yaml`](../openspec/config.yaml)；[`.omp/skills/`](../.omp/skills/)；[`.codex/skills/`](../.codex/skills/)；[`.claude/skills/`](../.claude/skills/)；[`.opencode/skills/`](../.opencode/skills/) | 每种 Agent 均有 `propose/apply/explore/sync/archive` 五个生成技能，metadata `generatedBy: 1.6.0` |
| AI 输出验证与迭代修复 | 审计记录保存 spec/文件/命令/结果；Lefthook 把快速反馈放到 commit，把完整 native/WASM/browser 门禁放到 push | [`src/agent/audit.ts`](../src/agent/audit.ts)；[`lefthook.yml`](../lefthook.yml) | 35 Bun + 4 CTest + 22 Playwright；pre-commit 1.27s，pre-push 20.91s（本工作站实测） |
| 一种可能误解及发现方式 | 双 Bank 只是一段 `Shelf.gemIds` 的 UI 切片；错误实现为双逻辑 Shelf 会被 replay/dump 发现 | [Tux 归档设计 §4](../openspec/changes/archive/2026-07-16-rebuild-tux-mosaic-stage/design.md)；[`src/app/App.tsx`](../src/app/App.tsx) | Tux trace、Shelf compaction tests |
| C++ 八方向连通题 | BFS，固定 `N→NE→E→SE→S→SW→W→NW`，入队即标记，稳定输出，$O(V)$ | [`cpp/connected_gems.hpp`](../cpp/connected_gems.hpp)；[`cpp/connected_gems.cpp`](../cpp/connected_gems.cpp) | [`cpp/connected_gems_test.cpp`](../cpp/connected_gems_test.cpp) |
| 代码题的 2–3 个测试 | 对角连通、锁定/异色屏障、无效起点；另含稳定顺序和输入不变性 | [`cpp/connected_gems_test.cpp`](../cpp/connected_gems_test.cpp) | native CTest |
| C++ / 游戏引擎加分项 | 同一 C++20 Core 同时构建为 native 和 Emscripten WASM；JSON v1 C ABI 隔离内存边界 | [`CMakeLists.txt`](../CMakeLists.txt)；[`src/wasm/game-core.ts`](../src/wasm/game-core.ts) | `tests/wasm/game-core.test.ts`；`tests/harness/differential.test.ts` |
| AI 以外的资产生成边界 | `pixel-bloom` 只做 RGBA 检查、语义调色板派生和本地预览；生产素材需人工审批 | [`src/pixel-bloom/`](../src/pixel-bloom/)；[资产归档设计](../openspec/changes/archive/2026-07-15-add-pixel-bloom-pipeline/design.md) | `tests/pixel-bloom/`；review artifacts |
| 生产表现不污染规则 | 普通/全局 WAAPI clone、终章、一次性提示和重玩控件都从已提交 transition/状态派生；重玩只 dispatch canonical restart，相机 token 不进入 state | [`src/app/App.tsx`](../src/app/App.tsx)；[`src/app/VictoryFinale.tsx`](../src/app/VictoryFinale.tsx)；[`src/styles.css`](../src/styles.css) | `tests/e2e/game.e2e.ts`；真实 desktop/mobile 浏览器烟测 |
| 可复现本地门禁 / CI / 部署 | 固定 Lefthook 2.1.10 与 OpenSpec 1.6.0；本地 pre-commit/pre-push 先挡失败，main CI 再独立运行并发布香港站与 Pages | [`lefthook.yml`](../lefthook.yml)；[`package.json`](../package.json)；[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `bunx lefthook run pre-commit --all-files`；`bunx lefthook run pre-push --all-files`；[CI workflow](https://github.com/cagedbird043/brilliant-sort/actions/workflows/ci.yml) |

## 固定提交与复现入口

- **答卷对应实现提交**：[`e5dab87bcf48`](https://github.com/cagedbird043/brilliant-sort/commit/e5dab87bcf48174a9c921e065e47515276913951)
- **线上演示**：[Hong Kong](https://brilliant-sort.cagedbird.cn/) · [GitHub Pages](https://cagedbird043.github.io/brilliant-sort/)
- **核心复现**：`bun run check`
- **浏览器回归**：`bun run test:e2e`
- **旗舰关卡逐命令回放**：`bun run harness replay tux-01`
- **三后端差分**：`bun run harness differential tux-01`
- **关卡生成漂移检查**：`bun run level:check:tux`
