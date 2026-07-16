# Brilliant Sort 笔试要求 → 可审计证据矩阵

本附录配合根目录 [`SUBMISSION.md`](../SUBMISSION.md) 阅读。所有链接均指向同一仓库、同一提交历史中的源码、归档规格或自动化证据；它不是测试标题汇总，而是让阅卷者能复查每个结论的来源。

| 题目要求 | 设计/实现结论 | 主要源码 | 自动化或上线证据 |
| --- | --- | --- | --- |
| 不超过 8 行的玩法假设 | 规则事实、延期能力和胜利边界被显式记录；不会把视频未展示的商业规则伪造为事实 | [`SUBMISSION.md#1-玩法假设`](../SUBMISSION.md#1-玩法假设)；[核心归档 proposal](../openspec/changes/archive/2026-07-15-add-brilliant-sort-core/proposal.md) | `tests/core/reducer.test.ts`、固定 fixture 验证 |
| 棋盘、格子、宝石、槽位、颜色、坐标和状态 | `LevelSpec` / `GameState` / `BoardCell` / `Gem` / `Shelf` / `Selection` 是版本化 TypeScript/C++ JSON 协议 | [`src/core/types.ts`](../src/core/types.ts)；[`src/core/level.ts`](../src/core/level.ts)；[`cpp/game_core.hpp`](../cpp/game_core.hpp) | `tests/core/reducer.test.ts`；`cpp/game_core_test.cpp` |
| 模块职责、输入输出与状态所有权 | C++ `BrilliantSortCore` 是生产规则权威；`GameCorePort` 只暴露 load/dispatch/snapshot/restart/destroy；UI 不直接写 state | [`src/core/port.ts`](../src/core/port.ts)；[`cpp/game_core.cpp`](../cpp/game_core.cpp)；[WASM 归档设计](../openspec/changes/archive/2026-07-16-add-pixel-crystal-renderer/design.md) | TypeScript ↔ native C++ ↔ WASM 差分回放 |
| 选择、放置、Shelf、全局修复与胜利流程 | 八方向最大分量、安全边界提取、同色目标批量放置、紧凑 Shelf 压缩、确定性全局身份配对、`Won` 谓词 | [`src/core/topology.ts`](../src/core/topology.ts)；[`src/core/reducer.ts`](../src/core/reducer.ts)；[`cpp/game_core.cpp`](../cpp/game_core.cpp) | `tests/core/reducer.test.ts`；`tests/core/global-wand.test.ts`；`cpp/game_core_test.cpp`；`tux-01.win.json` |
| Demo 一键全局修复 | `apply-global-wand` 保留锁定身份，按颜色将字典序 Gem ID 配对到行优先目标；只发一个聚合事件和一个 `won` | [归档 OpenSpec 设计](../openspec/changes/archive/2026-07-16-add-demo-assist-and-victory-finale/design.md)；[`src/core/types.ts`](../src/core/types.ts)；[`cpp/game_core.cpp`](../cpp/game_core.cpp) | 初始/中途状态 TypeScript、native C++、WASM canonical parity；`tests/core/global-wand.test.ts` |
| 全图飞行、胜利终章与一次性引导 | 136 个可移动身份由 pre/post 稳定位置派生；对角延迟曲线、Large↔Micro LOD、SVG 弧光、三组固定烟花与版本化提示均为表现层 | [`src/app/App.tsx`](../src/app/App.tsx)；[`src/app/VictoryFinale.tsx`](../src/app/VictoryFinale.tsx)；[`src/styles.css`](../src/styles.css) | 11 个场景 × desktop/mobile Chromium；含手动/魔法棒胜利、存储失败与 reduced-motion |
| UI / 表现 / Cocos 引擎层解耦 | React/DOM 只是表现适配器；C++ Core 不包含 DOM、素材、动画或 ARIA；未来引擎替换消费同一协议 | [`src/app/App.tsx`](../src/app/App.tsx)；[`src/wasm/game-core.ts`](../src/wasm/game-core.ts) | `tests/wasm/game-core.test.ts`；browser E2E |
| 纯逻辑、可驱动、可序列化 Harness 接口 | canonical JSON 稳定排序；每个 command 有 state/events/rejection；Harness 可 replay/diff | [`src/core/dump.ts`](../src/core/dump.ts)；[`src/harness/replay.ts`](../src/harness/replay.ts)；[`src/harness/diff.ts`](../src/harness/diff.ts) | `tests/harness/replay.test.ts` |
| 固定布局 / 固定随机测试场景 | 所有 baseline fixture 都是版本化 JSON；`tux-01` 的紧凑 map 经确定性编译 | [`src/fixtures/source/tux-01.map.json`](../src/fixtures/source/tux-01.map.json)；[`tools/compile-level-map.ts`](../tools/compile-level-map.ts) | `tests/fixtures/level-map.test.ts`；`bun run level:check:tux` |
| 读取棋盘、宝石、槽位、选择、胜利状态 | `snapshot()` 与 `canonicalDump` 完整覆盖 semantic state；不混入像素/对象引用 | [`src/core/port.ts`](../src/core/port.ts)；[`src/core/dump.ts`](../src/core/dump.ts) | WASM/Core replay tests |
| 模拟棋盘 / 空格 / 槽位 / 全局修复操作 | 所有 UI 操作被规范化为 `GameCommand`；Harness 直接 dispatch 相同命令，魔法棒没有 DOM 侧状态捷径 | [`src/core/types.ts`](../src/core/types.ts)；[`src/harness/cli.ts`](../src/harness/cli.ts) | `tests/e2e/game.e2e.ts`；`tests/harness/replay.test.ts`；`tests/harness/differential.test.ts` |
| 操作前后 dump 与比较 | `CoreTransition` 捕获 before/after、event 与 rejection；diff 返回首个 JSON 路径 | [`src/harness/differential.ts`](../src/harness/differential.ts) | `tests/harness/differential.test.ts` |
| 必须覆盖的自动化场景 | 对角连通、锁定/异色屏障、Shelf 容量/压缩、拒绝、Tux 完整胜利、全局修复、引导持久化/存储失败、手动/魔法棒终章、reduced-motion、重放确定性 | [`tests/core/`](../tests/core/)；[`tests/harness/`](../tests/harness/)；[`tests/wasm/`](../tests/wasm/)；[`tests/e2e/game.e2e.ts`](../tests/e2e/game.e2e.ts) | `bun run check`；`bun run test:e2e`；`bun run harness differential tux-01` |
| AI Agent 的正确上下文 | Agent 请求受 Scenario、相关 spec/文件与延期能力约束；延期能力直接阻断 | [`src/agent/context.ts`](../src/agent/context.ts)；[Agent Governance Spec](../openspec/specs/agent-governance/spec.md) | `tests/agent/context.test.ts` |
| AI 输出验证与迭代修复 | 审计记录包含 spec、改动文件、验证命令、结果、下一决策和时间戳；反馈来自可执行测试/诊断 | [`src/agent/audit.ts`](../src/agent/audit.ts) | `tests/agent/audit.test.ts`；CI workflow |
| 一种可能误解及发现方式 | 双 Bank 只是一段 `Shelf.gemIds` 的 UI 切片；错误实现为双逻辑 Shelf 会被 replay/dump 发现 | [Tux 归档设计 §4](../openspec/changes/archive/2026-07-16-rebuild-tux-mosaic-stage/design.md)；[`src/app/App.tsx`](../src/app/App.tsx) | Tux trace、Shelf compaction tests |
| C++ 八方向连通题 | BFS，固定 `N→NE→E→SE→S→SW→W→NW`，入队即标记，稳定输出，$O(V)$ | [`cpp/connected_gems.hpp`](../cpp/connected_gems.hpp)；[`cpp/connected_gems.cpp`](../cpp/connected_gems.cpp) | [`cpp/connected_gems_test.cpp`](../cpp/connected_gems_test.cpp) |
| 代码题的 2–3 个测试 | 对角连通、锁定/异色屏障、无效起点；另含稳定顺序和输入不变性 | [`cpp/connected_gems_test.cpp`](../cpp/connected_gems_test.cpp) | native CTest |
| C++ / 游戏引擎加分项 | 同一 C++20 Core 同时构建为 native 和 Emscripten WASM；JSON v1 C ABI 隔离内存边界 | [`CMakeLists.txt`](../CMakeLists.txt)；[`src/wasm/game-core.ts`](../src/wasm/game-core.ts) | `tests/wasm/game-core.test.ts`；`tests/harness/differential.test.ts` |
| AI 以外的资产生成边界 | `pixel-bloom` 只做 RGBA 检查、语义调色板派生和本地预览；生产素材需人工审批 | [`src/pixel-bloom/`](../src/pixel-bloom/)；[资产归档设计](../openspec/changes/archive/2026-07-15-add-pixel-bloom-pipeline/design.md) | `tests/pixel-bloom/`；review artifacts |
| 生产表现不污染规则 | 普通/全局 WAAPI clone、曲线波次、Large/Micro LOD、SVG 弧光、固定烟花、一次性提示和空 Socket 透明度仅从已提交 transition 派生；不会改 state | [`src/app/App.tsx`](../src/app/App.tsx)；[`src/app/VictoryFinale.tsx`](../src/app/VictoryFinale.tsx)；[`src/styles.css`](../src/styles.css) | `tests/e2e/game.e2e.ts`；真实 desktop/mobile 浏览器烟测 |
| 可复现 CI / 部署 | main 推送依次运行 typecheck、native、WASM、Bun、CTest、Chromium E2E，然后静态发布香港站与 Pages | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | [Brilliant Sort CI workflow](https://github.com/cagedbird043/brilliant-sort/actions/workflows/ci.yml) |

## 固定提交与复现入口

- **答卷对应实现提交**：[`c9dc26fecfcb`](https://github.com/cagedbird043/brilliant-sort/commit/c9dc26fecfcb43d4e79eb693510b3e445b76787e)
- **线上演示**：[Hong Kong](https://brilliant-sort.cagedbird.cn/) · [GitHub Pages](https://cagedbird043.github.io/brilliant-sort/)
- **核心复现**：`bun run check`
- **浏览器回归**：`bun run test:e2e`
- **旗舰关卡逐命令回放**：`bun run harness replay tux-01`
- **三后端差分**：`bun run harness differential tux-01`
- **关卡生成漂移检查**：`bun run level:check:tux`
