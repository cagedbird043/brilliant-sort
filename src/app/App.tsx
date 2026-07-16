import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { coordFromKey, keyOf } from "../core/coords";
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
import {
  deriveAudioCues,
  getBrowserPixelAudioPort,
  type BrowserPixelAudioPort,
  type PixelAudioSnapshot,
} from "../audio";
import { tuxLevel } from "../fixtures";
import { GameCoreFactory } from "../wasm/game-core";
import { BoardCamera } from "./BoardCamera";
import { calculateStageLayout } from "./stage-layout";
import audioCrystal from "../assets/pixel/audio-crystal.svg";
import largeAmber from "../assets/pixel/gems/amber.png";
import largeCoral from "../assets/pixel/gems/coral.png";
import largeIce from "../assets/pixel/gems/ice.png";
import largeJade from "../assets/pixel/gems/jade.png";
import largeNavy from "../assets/pixel/gems/navy.png";
import largeObsidian from "../assets/pixel/gems/obsidian.png";
import largePearl from "../assets/pixel/gems/pearl.png";
import microAmber from "../assets/pixel/micro/amber.png";
import microCoral from "../assets/pixel/micro/coral.png";
import microIce from "../assets/pixel/micro/ice.png";
import microJade from "../assets/pixel/micro/jade.png";
import microNavy from "../assets/pixel/micro/navy.png";
import microObsidian from "../assets/pixel/micro/obsidian.png";
import microPearl from "../assets/pixel/micro/pearl.png";
import microSocket from "../assets/pixel/micro/neutral.png";
import shelfTray from "../assets/pixel/shelf-tray-neutral.png";

type FeedbackTone = "neutral" | "selected" | "placed" | "compacted" | "rejected" | "won";

interface MotionRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface MotionSource {
  readonly rect: MotionRect;
  readonly element: HTMLElement;
}

interface PendingMotion {
  readonly token: number;
  readonly movedGemIds: readonly string[];
  readonly sources: ReadonlyMap<string, MotionSource>;
  readonly previousShelfIds: ReadonlySet<string>;
  readonly nextShelfIds: ReadonlySet<string>;
}

const MOTION_DURATION_MS = 240;

const COLOR_LABEL: Record<Color, string> = {
  navy: "深蓝",
  ice: "冰蓝",
  coral: "珊瑚红",
  jade: "翡翠绿",
  obsidian: "黑曜石",
  pearl: "珍珠白",
  amber: "琥珀橙",
};

const LARGE_GEM_SPRITE: Record<Color, string> = {
  navy: largeNavy,
  ice: largeIce,
  coral: largeCoral,
  jade: largeJade,
  obsidian: largeObsidian,
  pearl: largePearl,
  amber: largeAmber,
};

const MICRO_GEM_SPRITE: Record<Color, string> = {
  navy: microNavy,
  ice: microIce,
  coral: microCoral,
  jade: microJade,
  obsidian: microObsidian,
  pearl: microPearl,
  amber: microAmber,
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


type GemSpriteFamily = "large" | "micro";

interface GemSpriteProps {
  readonly gemId: string;
  readonly color: Color;
  readonly selected: boolean;
  readonly locked: boolean;
  readonly family: GemSpriteFamily;
}

function GemSprite({ gemId, color, selected, locked, family }: GemSpriteProps) {
  return (
    <span
      className={`gem family-${family} gem-${color}${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
      data-gem-id={gemId}
      aria-hidden="true"
    >
      <span className="gem-shadow" />
      <img
        className="pixel-sprite gem-sprite"
        src={family === "micro" ? MICRO_GEM_SPRITE[color] : LARGE_GEM_SPRITE[color]}
        alt=""
      />
    </span>
  );
}

interface ShelfBankProps {
  readonly bank: "a" | "b";
  readonly indices: readonly number[];
  readonly state: GameState;
  readonly inputLocked: boolean;
  readonly rejectedShelf: number | null;
  readonly onSlotClick: (index: number, gemId: string | undefined) => void;
}

function ShelfBank({
  bank,
  indices,
  state,
  inputLocked,
  rejectedShelf,
  onSlotClick,
}: ShelfBankProps) {
  return (
    <section className={`shelf-bank bank-${bank}`} aria-label={`缓冲 Shelf ${bank.toUpperCase()}`}>
      <div className="shelf-grid">
        {indices.map((index) => {
          const gemId = state.shelf.gemIds[index];
          const gem = gemId ? state.gems[gemId] : null;
          const selected = Boolean(gem && state.selection?.gemIds.includes(gem.id));
          return (
            <button
              className={`shelf-slot${selected ? " is-selected" : ""}${gem ? " has-gem" : ""}${rejectedShelf === index ? " is-rejected" : ""}`}
              data-testid={`shelf-slot-${index}`}
              type="button"
              key={index}
              onClick={() => onSlotClick(index, gemId)}
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
                  family="large"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
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
  const feedbackTimerRef = useRef<number | null>(null);
  const motionTokenRef = useRef(0);
  const pendingMotionRef = useRef<PendingMotion | null>(null);
  const activeMotionCleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const shellRef = useRef<HTMLElement | null>(null);
  const audioPortRef = useRef<BrowserPixelAudioPort | null>(null);
  const audioSequenceRef = useRef(0);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [state, setState] = useState<GameState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [activity, setActivity] = useState("点击颜色错误的宝石开始整理。");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [inputLocked, setInputLocked] = useState(false);
  const [rejectedCell, setRejectedCell] = useState<string | null>(null);
  const [rejectedShelf, setRejectedShelf] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const [audioSnapshot, setAudioSnapshot] = useState<PixelAudioSnapshot>({
    status: "loading",
    muted: false,
  });
  const [stageViewport, setStageViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const port = getBrowserPixelAudioPort();
    audioPortRef.current = port;
    const unsubscribe = port.subscribe(setAudioSnapshot);
    void port.prepare();
    return () => {
      unsubscribe();
      audioPortRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setBootError(null);
    void GameCoreFactory.load(tuxLevel)
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
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (shell === null) {
      return;
    }
    const update = () => {
      const computed = window.getComputedStyle(shell);
      const horizontalPadding =
        Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight);
      const verticalPadding =
        Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom);
      const visualHeight = window.visualViewport?.height ?? shell.clientHeight;
      const next = {
        width: Math.max(1, shell.clientWidth - horizontalPadding),
        height: Math.max(1, Math.min(shell.clientHeight, visualHeight) - verticalPadding),
      };
      setStageViewport((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    window.visualViewport?.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [state?.levelId]);


  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeMotionCleanupRef.current?.();
      activeMotionCleanupRef.current = null;
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const plan = pendingMotionRef.current;
    if (plan === null || reducedMotion) {
      return;
    }
    pendingMotionRef.current = null;
    activeMotionCleanupRef.current?.();

    const movedIds = new Set(plan.movedGemIds);
    const hiddenDestinations: HTMLElement[] = [];
    const clones: HTMLElement[] = [];
    const animations: Animation[] = [];

    for (const gemId of plan.movedGemIds) {
      const source = plan.sources.get(gemId);
      const destination = findGemElement(gemId);
      if (source === undefined || destination === null) {
        continue;
      }

      const to = rectOf(destination);
      destination.style.visibility = "hidden";
      destination.dataset.motionDestination = "hidden";
      hiddenDestinations.push(destination);

      const clone = source.element.cloneNode(true) as HTMLElement;
      clone.classList.remove("is-selected", "is-locked", "is-landing");
      clone.classList.add("gem-flight-clone");
      clone.removeAttribute("data-gem-id");
      clone.dataset.flightGemId = gemId;
      Object.assign(clone.style, {
        position: "fixed",
        left: `${source.rect.left}px`,
        top: `${source.rect.top}px`,
        width: `${source.rect.width}px`,
        height: `${source.rect.height}px`,
        margin: "0",
        pointerEvents: "none",
        transform: "translate3d(0, 0, 0)",
        zIndex: "1000",
      });
      document.body.append(clone);
      clones.push(clone);
      animations.push(
        clone.animate(
          [
            { transform: "translate3d(0, 0, 0)" },
            {
              transform: `translate3d(${to.left - source.rect.left}px, ${to.top - source.rect.top}px, 0)`,
            },
          ],
          {
            duration: MOTION_DURATION_MS,
            easing: "cubic-bezier(0.22, 0.78, 0.2, 1)",
            fill: "forwards",
          },
        ),
      );
    }

    for (const gemId of plan.previousShelfIds) {
      if (movedIds.has(gemId) || !plan.nextShelfIds.has(gemId)) {
        continue;
      }
      const source = plan.sources.get(gemId);
      const destination = findGemElement(gemId);
      if (source === undefined || destination === null) {
        continue;
      }
      const to = rectOf(destination);
      const deltaX = source.rect.left - to.left;
      const deltaY = source.rect.top - to.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        continue;
      }
      animations.push(
        destination.animate(
          [
            { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          {
            duration: MOTION_DURATION_MS,
            easing: "cubic-bezier(0.22, 0.78, 0.2, 1)",
          },
        ),
      );
    }

    let cleaned = false;
    let safetyTimer = 0;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      window.clearTimeout(safetyTimer);
      for (const animation of animations) {
        animation.cancel();
      }
      for (const clone of clones) {
        clone.remove();
      }
      for (const destination of hiddenDestinations) {
        destination.style.removeProperty("visibility");
        delete destination.dataset.motionDestination;
      }
      if (activeMotionCleanupRef.current === cleanup) {
        activeMotionCleanupRef.current = null;
      }
      if (mountedRef.current && motionTokenRef.current === plan.token) {
        setInputLocked(false);
      }
    };
    activeMotionCleanupRef.current = cleanup;
    safetyTimer = window.setTimeout(cleanup, MOTION_DURATION_MS + 400);
    if (animations.length === 0) {
      cleanup();
    } else {
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanup);
    }
  }, [reducedMotion, state]);

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
      audioPortRef.current?.resumeFromGesture();

      const beforeState = core.snapshot();
      const motionSources = new Map<string, MotionSource>();
      if (!reducedMotion) {
        document.querySelectorAll<HTMLElement>("[data-gem-id]").forEach((element) => {
          const gemId = element.dataset.gemId;
          if (gemId) {
            motionSources.set(gemId, {
              rect: rectOf(element),
              element: element.cloneNode(true) as HTMLElement,
            });
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

      const audio = deriveAudioCues(result, command, audioSequenceRef.current);
      audioSequenceRef.current = audio.nextSequence;
      for (const cue of audio.cues) {
        audioPortRef.current?.pushCue(cue);
      }
      const feedback = describeTransition(result, command);
      const movedIds = result.rejection === null ? movedGemIds(result) : [];
      if (!reducedMotion && movedIds.length > 0) {
        const token = ++motionTokenRef.current;
        pendingMotionRef.current = {
          token,
          movedGemIds: movedIds,
          sources: motionSources,
          previousShelfIds: new Set(beforeState.shelf.gemIds),
          nextShelfIds: new Set(result.state.shelf.gemIds),
        };
        setInputLocked(true);
      }

      setState(result.state);
      setActivity(feedback.message);
      setFeedbackTone(feedback.tone);
      if (result.rejection) {
        showRejection(command);
      }
    },
    [inputLocked, reducedMotion, showRejection],
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

  const stageLayout = calculateStageLayout({
    width: stageViewport.width,
    height: stageViewport.height,
    rows: state.board.rows,
    cols: state.board.cols,
    shelfCapacity: state.shelf.capacity,
  });
  const boardSlots = Object.entries(state.board.cells)
    .map(([cellKey, cell]) => ({ coord: coordFromKey(cellKey), cell }))
    .sort(
      (left, right) =>
        left.coord.row - right.coord.row || left.coord.col - right.coord.col,
    );
  const boardWidth = state.board.cols * stageLayout.boardCellSize;
  const boardHeight = state.board.rows * stageLayout.boardCellSize;
  const shelfIndices = Array.from({ length: state.shelf.capacity }, (_, index) => index);
  const bankAIndices = shelfIndices.slice(0, stageLayout.bankSplitIndex);
  const bankBIndices = shelfIndices.slice(stageLayout.bankSplitIndex);
  const stageStyle = {
    "--board-cell": `${stageLayout.boardCellSize}px`,
    "--bank-cell": `${stageLayout.bankCellSize}px`,
  } as CSSProperties;

  return (
    <main className="workbench-shell" data-feedback={feedbackTone} ref={shellRef}>
      <button
        className={`audio-crystal-control${audioSnapshot.muted ? " is-muted" : ""}${audioSnapshot.status === "failed" ? " is-unavailable" : ""}`}
        type="button"
        data-audio-status={audioSnapshot.status}
        aria-label={audioSnapshot.muted ? "恢复像素音乐" : "静音像素音乐"}
        aria-pressed={audioSnapshot.muted}
        disabled={audioSnapshot.status === "failed"}
        onClick={() => {
          const port = audioPortRef.current;
          port?.resumeFromGesture();
          port?.setMuted(!audioSnapshot.muted);
        }}
      >
        <img src={audioCrystal} alt="" aria-hidden="true" />
      </button>
      <section
        className={`crystal-workbench stage-${stageLayout.orientation}${state.status === "won" ? " is-won" : ""}`}
        style={stageStyle}
        aria-label="Brilliant Sort 游戏"
      >
        <ShelfBank
          bank="a"
          indices={bankAIndices}
          state={state}
          inputLocked={inputLocked}
          rejectedShelf={rejectedShelf}
          onSlotClick={handleShelfClick}
        />

        <section className="calibration-bay" aria-label="Tux 宝石棋盘">
          <BoardCamera
            enabled={!stageLayout.directTouch}
            maxZoom={stageLayout.maxZoom}
            resetKey={`${state.levelId}:${stageLayout.orientation}:${boardWidth}x${boardHeight}`}
            width={boardWidth}
            height={boardHeight}
          >
            <div
              className="game-board"
              style={{
                width: `${boardWidth}px`,
                height: `${boardHeight}px`,
                gridTemplateColumns: `repeat(${state.board.cols}, ${stageLayout.boardCellSize}px)`,
                gridTemplateRows: `repeat(${state.board.rows}, ${stageLayout.boardCellSize}px)`,
              }}
            >
              {boardSlots.map(({ coord, cell }) => {
                const gem = cell.gemId ? state.gems[cell.gemId] : null;
                const selected = Boolean(gem && state.selection?.gemIds.includes(gem.id));
                const locked = Boolean(gem && gem.color === cell.targetColor);
                const rejected = rejectedCell === keyOf(coord);
                return (
                  <button
                    className={`board-cell target-${cell.targetColor}${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}${rejected ? " is-rejected" : ""}`}
                    data-testid={`board-cell-${coord.row}-${coord.col}`}
                    type="button"
                    key={keyOf(coord)}
                    style={{ gridColumnStart: coord.col + 1, gridRowStart: coord.row + 1 }}
                    onClick={() => handleBoardClick(coord, cell)}
                    disabled={inputLocked || state.status === "won" || locked}
                    aria-label={describeCell(cell, state)}
                  >
                    <span className="target-underlay" aria-hidden="true" />
                    <img className="pixel-sprite socket-sprite" src={microSocket} alt="" aria-hidden="true" />
                    {gem ? (
                      <GemSprite
                        gemId={gem.id}
                        color={gem.color}
                        selected={selected}
                        locked={locked}
                        family="micro"
                      />
                    ) : (
                      <span className="empty-socket-mark" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </BoardCamera>
        </section>

        <ShelfBank
          bank="b"
          indices={bankBIndices}
          state={state}
          inputLocked={inputLocked}
          rejectedShelf={rejectedShelf}
          onSlotClick={handleShelfClick}
        />

        <p
          className="activity-announcer"
          role="status"
          aria-live={feedbackTone === "won" ? "assertive" : "polite"}
        >
          {activity}
        </p>
      </section>
    </main>
  );
}
