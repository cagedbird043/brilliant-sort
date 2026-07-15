import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { keyOf } from "../core/coords";
import type {
  BoardCell,
  Color,
  Coord,
  CoreTransition,
  GameCommand,
  GameCorePort,
  GameState,
  RejectionCode,
} from "../core";
import { prismLevel } from "../fixtures";
import { GameCoreFactory } from "../wasm/game-core";
import gemCoral from "../assets/pixel/gem-coral.png";
import gemIce from "../assets/pixel/gem-ice.png";
import gemJade from "../assets/pixel/gem-jade.png";
import gemNavy from "../assets/pixel/gem-navy.png";
import shelfTray from "../assets/pixel/shelf-tray-neutral.png";
import socket from "../assets/pixel/socket-neutral.png";

type FeedbackTone = "neutral" | "selected" | "placed" | "compacted" | "rejected" | "won";

interface MotionRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface GemGhost {
  readonly key: number;
  readonly gemId: string;
  readonly color: Color;
  readonly from: MotionRect;
  readonly to: MotionRect;
  readonly isMoving: boolean;
}

const MOTION_DURATION_MS = 180;

const COLOR_LABEL: Record<Color, string> = {
  navy: "深蓝",
  ice: "冰蓝",
  coral: "珊瑚红",
  jade: "翡翠绿",
};

const GEM_SPRITE: Record<Color, string> = {
  navy: gemNavy,
  ice: gemIce,
  coral: gemCoral,
  jade: gemJade,
};

const REJECTION_LABEL: Record<RejectionCode, string> = {
  "game-won": "本局已经完成，重置后可以再次整理。",
  "no-selectable-gem": "这里没有可移动的宝石。",
  "locked-gem": "颜色正确的宝石已经固定。",
  "no-selection": "先选择一组颜色错误的宝石。",
  "target-color-mismatch": "把宝石送到同色的空格。",
  "target-is-occupied": "这个目标格已经有宝石了。",
  "invalid-target": "请点击棋盘中的有效目标格。",
  "shelf-full": "缓冲槽已满，先把其中的宝石归位。",
  "selection-must-come-from-board": "只有棋盘上的选择可以放入缓冲槽。",
};

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function describeCell(cell: BoardCell, state: GameState): string {
  if (!cell.gemId) {
    return `${COLOR_LABEL[cell.targetColor]}目标空位`;
  }

  const gem = state.gems[cell.gemId];
  if (!gem) {
    return "宝石状态异常";
  }
  const status = gem.color === cell.targetColor ? "已固定" : "可移动";
  return `${COLOR_LABEL[gem.color]}宝石，${COLOR_LABEL[cell.targetColor]}目标，${status}`;
}

function describeTransition(
  result: CoreTransition,
  command: GameCommand,
): { readonly message: string; readonly tone: FeedbackTone } {
  if (result.rejection) {
    return { message: REJECTION_LABEL[result.rejection.code], tone: "rejected" };
  }
  if (command.type === "restart-level") {
    return { message: "校准台已重置。", tone: "neutral" };
  }
  if (result.events.some((event) => event.type === "won")) {
    return { message: "所有宝石都已归位。", tone: "won" };
  }
  if (result.events.some((event) => event.type === "shelf-compacted")) {
    return { message: "缓冲槽已自动补位。", tone: "compacted" };
  }

  const placedCount = result.events.filter((event) => event.type === "gem-placed").length;
  if (placedCount > 0) {
    return {
      message: placedCount === 1 ? "一颗宝石已归位。" : `${placedCount} 颗宝石正在归位。`,
      tone: "placed",
    };
  }
  if (result.state.selection) {
    return {
      message: `已选中 ${result.state.selection.gemIds.length} 颗同色宝石。`,
      tone: "selected",
    };
  }
  return { message: "选择已取消。", tone: "neutral" };
}

function rectOf(element: Element): MotionRect {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function findGemElement(gemId: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-gem-id]")).find(
      (element) => element.dataset.gemId === gemId,
    ) ?? null
  );
}

function movedGemIds(result: CoreTransition): readonly string[] {
  return result.events.flatMap((event) => {
    if (event.type !== "gem-placed" || !event.detail) {
      return [];
    }
    const [gemId] = event.detail.split("->", 1);
    return gemId ? [gemId] : [];
  });
}

function IconReset() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 5V2L1 5l3 3V6a4.6 4.6 0 1 1-1.1 4.8" />
    </svg>
  );
}

function IconStore() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1v8M5 6l3 3 3-3M2 11h12v3H2z" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m4 4 8 8M12 4 4 12" />
    </svg>
  );
}

interface GemSpriteProps {
  readonly gemId: string;
  readonly color: Color;
  readonly selected: boolean;
  readonly locked: boolean;
  readonly landing: boolean;
}

function GemSprite({ gemId, color, selected, locked, landing }: GemSpriteProps) {
  return (
    <span
      className={`gem gem-${color}${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}${landing ? " is-landing" : ""}`}
      data-gem-id={gemId}
      aria-hidden="true"
    >
      <span className="gem-shadow" />
      <img className="pixel-sprite gem-sprite" src={GEM_SPRITE[color]} alt="" />
    </span>
  );
}

function BootPanel({ error, onRetry }: { readonly error: string | null; readonly onRetry: () => void }) {
  return (
    <main className="boot-shell">
      <section className="boot-panel" aria-live="polite" aria-label="Brilliant Sort 核心状态">
        <span className="boot-sigil" aria-hidden="true" />
        <p>BRILLIANT SORT / CORE LINK</p>
        {error ? (
          <>
            <h1>核心未启动</h1>
            <span>{error}</span>
            <button className="icon-control boot-retry" type="button" onClick={onRetry} aria-label="重试加载核心" title="重试加载核心">
              <IconReset />
            </button>
          </>
        ) : (
          <>
            <h1>校准台连接中</h1>
            <span>正在加载确定性规则核心。</span>
          </>
        )}
      </section>
    </main>
  );
}

export function App() {
  const coreRef = useRef<GameCorePort | null>(null);
  const motionTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const ghostSequenceRef = useRef(0);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [state, setState] = useState<GameState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [activity, setActivity] = useState("点击颜色错误的宝石开始整理。");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [inputLocked, setInputLocked] = useState(false);
  const [rejectedCell, setRejectedCell] = useState<string | null>(null);
  const [rejectedShelf, setRejectedShelf] = useState<number | null>(null);
  const [landingGemIds, setLandingGemIds] = useState<readonly string[]>([]);
  const [ghosts, setGhosts] = useState<readonly GemGhost[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setBootError(null);
    void GameCoreFactory.load(prismLevel)
      .then((core) => {
        if (cancelled) {
          core.destroy();
          return;
        }
        coreRef.current = core;
        setState(core.snapshot());
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : "无法加载 WebAssembly 核心。");
        }
      });

    return () => {
      cancelled = true;
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, [bootAttempt]);

  useEffect(
    () => () => {
      if (motionTimerRef.current !== null) {
        window.clearTimeout(motionTimerRef.current);
      }
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    },
    [],
  );

  const clearMotion = useCallback(() => {
    setGhosts([]);
    setLandingGemIds([]);
    setInputLocked(false);
  }, []);

  const armInputLock = useCallback(() => {
    setInputLocked(true);
    if (motionTimerRef.current !== null) {
      window.clearTimeout(motionTimerRef.current);
    }
    motionTimerRef.current = window.setTimeout(() => {
      motionTimerRef.current = null;
      clearMotion();
    }, MOTION_DURATION_MS);
  }, [clearMotion]);

  const showRejection = useCallback((command: GameCommand) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    if (command.type === "place-selection-at-target" || command.type === "select-board-gem") {
      setRejectedCell(keyOf(command.coord));
      setRejectedShelf(null);
    } else if (command.type === "select-shelf-gem") {
      setRejectedCell(null);
      setRejectedShelf(command.index);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      setRejectedCell(null);
      setRejectedShelf(null);
    }, MOTION_DURATION_MS);
  }, []);

  const applyCommand = useCallback(
    (command: GameCommand) => {
      const core = coreRef.current;
      if (!core || inputLocked) {
        return;
      }

      const beforeState = core.snapshot();
      const beforeRects = new Map<string, MotionRect>();
      if (!reducedMotion) {
        document.querySelectorAll<HTMLElement>("[data-gem-id]").forEach((element) => {
          const gemId = element.dataset.gemId;
          if (gemId) {
            beforeRects.set(gemId, rectOf(element));
          }
        });
      }

      let result: CoreTransition;
      try {
        result = core.dispatch(command);
      } catch (error) {
        setFeedbackTone("rejected");
        setActivity(error instanceof Error ? `核心通信失败：${error.message}` : "核心通信失败。");
        return;
      }
      const feedback = describeTransition(result, command);
      setState(result.state);
      setActivity(feedback.message);
      setFeedbackTone(feedback.tone);

      if (result.rejection) {
        showRejection(command);
        return;
      }

      const movedIds = movedGemIds(result);
      if (movedIds.length === 0 || reducedMotion) {
        return;
      }

      setLandingGemIds(movedIds);
      armInputLock();
      const previousShelfIds = new Set(beforeState.shelf.gemIds);
      const nextShelfIds = new Set(result.state.shelf.gemIds);
      window.requestAnimationFrame(() => {
        const plans = movedIds.flatMap((gemId) => {
          const from = beforeRects.get(gemId);
          const destination = findGemElement(gemId);
          const gem = result.state.gems[gemId];
          if (!from || !destination || !gem) {
            return [];
          }
          return [{
            key: ++ghostSequenceRef.current,
            gemId,
            color: gem.color,
            from,
            to: rectOf(destination),
            isMoving: false,
          }];
        });
        if (plans.length > 0) {
          setGhosts(plans);
          window.requestAnimationFrame(() => {
            setGhosts((current) => current.map((ghost) => ({ ...ghost, isMoving: true })));
          });
        }

        for (const gemId of previousShelfIds) {
          if (!nextShelfIds.has(gemId)) {
            continue;
          }
          const from = beforeRects.get(gemId);
          const destination = findGemElement(gemId);
          if (!from || !destination) {
            continue;
          }
          const to = rectOf(destination);
          const deltaX = from.left - to.left;
          const deltaY = from.top - to.top;
          if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
            continue;
          }
          destination.animate(
            [
              { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
              { transform: "translate3d(0, 0, 0)" },
            ],
            { duration: MOTION_DURATION_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
          );
        }
      });
    },
    [armInputLock, inputLocked, reducedMotion, showRejection],
  );

  const handleBoardClick = useCallback(
    (coord: Coord, cell: BoardCell) => {
      if (!state || state.status === "won" || inputLocked) {
        return;
      }
      if (state.selection && cell.gemId === null) {
        applyCommand({ type: "place-selection-at-target", coord });
        return;
      }
      applyCommand({ type: "select-board-gem", coord });
    },
    [applyCommand, inputLocked, state],
  );

  const handleShelfClick = useCallback(
    (index: number, gemId: string | undefined) => {
      if (!state || state.status === "won" || inputLocked) {
        return;
      }
      if (gemId) {
        applyCommand({ type: "select-shelf-gem", index });
        return;
      }
      if (state.selection?.container === "board") {
        applyCommand({ type: "place-selection-in-shelf" });
      }
    },
    [applyCommand, inputLocked, state],
  );

  if (!state) {
    return <BootPanel error={bootError} onRetry={() => setBootAttempt((attempt) => attempt + 1)} />;
  }

  const selectedCount = state.selection?.gemIds.length ?? 0;
  const shelfFreeSlots = state.shelf.capacity - state.shelf.gemIds.length;
  const boardSlots = Array.from({ length: state.board.rows * state.board.cols }, (_, index) => {
    const coord = { row: Math.floor(index / state.board.cols), col: index % state.board.cols };
    return { coord, cell: state.board.cells[keyOf(coord)] };
  });

  return (
    <main className="workbench-shell" data-feedback={feedbackTone}>
      <section className="crystal-workbench" aria-label="Brilliant Sort 游戏">
        <header className="workbench-header" aria-label="关卡状态">
          <div className="brand-lockup">
            <span className="brand-sigil" aria-hidden="true" />
            <div>
              <p>BRILLIANT SORT / CRYSTAL REPAIR</p>
              <h1>关卡 01</h1>
            </div>
          </div>
          <div className="header-tools">
            <div className="run-status" aria-live="polite">
              <span className="status-indicator" aria-hidden="true" />
              <span>{state.status === "won" ? "已完成" : "整理中"}</span>
            </div>
            <button
              className="icon-control"
              type="button"
              onClick={() => applyCommand({ type: "restart-level" })}
              disabled={inputLocked}
              aria-label="重新开始关卡"
              title="重新开始关卡"
            >
              <IconReset />
            </button>
          </div>
        </header>

        <section className="calibration-bay" aria-label="宝石棋盘">
          <div className="bay-caption">
            <div>
              <p>棱镜校准阵列</p>
              <span>把每颗宝石送回对应光谱槽。</span>
            </div>
            <span className={`selection-readout${selectedCount ? " is-active" : ""}`}>
              {selectedCount ? `锁定 ${selectedCount}` : "待命"}
            </span>
          </div>

          <div className="board-chassis">
            <div
              className="game-board"
              style={
                {
                  gridTemplateColumns: `repeat(${state.board.cols}, minmax(0, 1fr))`,
                  "--board-columns": state.board.cols,
                } as CSSProperties
              }
            >
              {boardSlots.map(({ coord, cell }) => {
                if (!cell) {
                  return <div className="board-void" key={keyOf(coord)} aria-hidden="true" />;
                }
                const gem = cell.gemId ? state.gems[cell.gemId] : null;
                const selected = Boolean(gem && state.selection?.gemIds.includes(gem.id));
                const locked = Boolean(gem && gem.color === cell.targetColor);
                const landing = Boolean(gem && landingGemIds.includes(gem.id));
                const rejected = rejectedCell === keyOf(coord);
                return (
                  <button
                    className={`board-cell target-${cell.targetColor}${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}${rejected ? " is-rejected" : ""}`}
                    data-testid={`board-cell-${coord.row}-${coord.col}`}
                    type="button"
                    key={keyOf(coord)}
                    onClick={() => handleBoardClick(coord, cell)}
                    disabled={inputLocked || state.status === "won" || locked}
                    aria-label={describeCell(cell, state)}
                  >
                    <span className="target-underlay" aria-hidden="true" />
                    <img className="pixel-sprite socket-sprite" src={socket} alt="" aria-hidden="true" />
                    {gem ? (
                      <GemSprite
                        gemId={gem.id}
                        color={gem.color}
                        selected={selected}
                        locked={locked}
                        landing={landing}
                      />
                    ) : (
                      <span className="empty-socket-mark" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {state.status === "won" ? (
              <aside className="completion-plaque" role="status" aria-live="assertive">
                <span className="completion-sigil" aria-hidden="true" />
                <div>
                  <p>CALIBRATION COMPLETE</p>
                  <h2>棱镜已归位</h2>
                  <span>缓冲槽已清空。</span>
                </div>
                <button
                  className="icon-control completion-replay"
                  type="button"
                  onClick={() => applyCommand({ type: "restart-level" })}
                  disabled={inputLocked}
                  aria-label="再玩一次"
                  title="再玩一次"
                >
                  <IconReset />
                </button>
              </aside>
            ) : null}
          </div>

          <p className="activity-log" data-tone={feedbackTone} aria-live="polite">
            {activity}
          </p>
        </section>

        <section className="shelf-dock" aria-label="缓冲 Shelf">
          <div className="shelf-heading">
            <div>
              <p>缓冲导轨</p>
              <span>{shelfFreeSlots} 个空位 / 12 槽</span>
            </div>
            <div className="shelf-actions">
              {state.selection?.container === "board" ? (
                <button
                  className="icon-control store-control"
                  type="button"
                  onClick={() => applyCommand({ type: "place-selection-in-shelf" })}
                  disabled={inputLocked}
                  aria-label="暂存选中的宝石"
                  title="暂存选中的宝石"
                >
                  <IconStore />
                </button>
              ) : null}
              {state.selection ? (
                <button
                  className="icon-control clear-control"
                  type="button"
                  onClick={() => applyCommand({ type: "cancel-selection" })}
                  disabled={inputLocked}
                  aria-label="取消当前选择"
                  title="取消当前选择"
                >
                  <IconClear />
                </button>
              ) : null}
            </div>
          </div>
          <div className="shelf-rail">
            <div
              className="shelf-grid"
              style={{ gridTemplateColumns: `repeat(${state.shelf.width}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: state.shelf.capacity }, (_, index) => {
                const gemId = state.shelf.gemIds[index];
                const gem = gemId ? state.gems[gemId] : null;
                const selected = Boolean(gem && state.selection?.gemIds.includes(gem.id));
                const landing = Boolean(gem && landingGemIds.includes(gem.id));
                return (
                  <button
                    className={`shelf-slot${selected ? " is-selected" : ""}${gem ? " has-gem" : ""}${rejectedShelf === index ? " is-rejected" : ""}`}
                    data-testid={`shelf-slot-${index}`}
                    type="button"
                    key={index}
                    onClick={() => handleShelfClick(index, gemId)}
                    disabled={inputLocked || state.status === "won"}
                    aria-label={gem ? `${COLOR_LABEL[gem.color]}宝石缓冲槽` : "空缓冲槽"}
                  >
                    <img className="pixel-sprite shelf-sprite" src={shelfTray} alt="" aria-hidden="true" />
                    {gem ? (
                      <GemSprite
                        gemId={gem.id}
                        color={gem.color}
                        selected={selected}
                        locked={false}
                        landing={landing}
                      />
                    ) : (
                      <span className="slot-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </section>

      {ghosts.map((ghost) => {
        const style = {
          "--ghost-from-x": `${ghost.from.left}px`,
          "--ghost-from-y": `${ghost.from.top}px`,
          "--ghost-to-x": `${ghost.to.left}px`,
          "--ghost-to-y": `${ghost.to.top}px`,
          width: `${ghost.from.width}px`,
          height: `${ghost.from.height}px`,
        } as CSSProperties;
        return (
          <span
            className={`gem-motion-ghost${ghost.isMoving ? " is-moving" : ""}`}
            key={ghost.key}
            style={style}
            aria-hidden="true"
          >
            <img className="pixel-sprite" src={GEM_SPRITE[ghost.color]} alt="" />
          </span>
        );
      })}
    </main>
  );
}
