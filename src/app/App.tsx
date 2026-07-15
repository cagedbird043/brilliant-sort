import { useCallback, useMemo, useState } from "react";
import { keyOf } from "../core/coords";
import { createGameState } from "../core/level";
import { reduce } from "../core/reducer";
import type {
  BoardCell,
  Coord,
  GameCommand,
  GameState,
  ReduceResult,
  RejectionCode,
} from "../core/types";
import { prismLevel } from "../fixtures";

type FeedbackTone = "neutral" | "selected" | "placed" | "compacted" | "rejected" | "won";

const COLOR_LABEL: Record<string, string> = {
  navy: "深蓝",
  ice: "冰蓝",
  coral: "珊瑚红",
  jade: "翡翠绿",
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

function describeCell(cell: BoardCell, state: GameState): string {
  if (!cell.gemId) {
    return `${COLOR_LABEL[cell.targetColor]}目标空位`;
  }

  const gem = state.gems[cell.gemId];
  const status = gem.color === cell.targetColor ? "已固定" : "可移动";
  return `${COLOR_LABEL[gem.color]}宝石，${COLOR_LABEL[cell.targetColor]}目标，${status}`;
}

function describeTransition(result: ReduceResult, command: GameCommand): {
  readonly message: string;
  readonly tone: FeedbackTone;
} {
  if (result.rejection) {
    return { message: REJECTION_LABEL[result.rejection.code], tone: "rejected" };
  }

  if (command.type === "restart-level") {
    return { message: "关卡已重置。", tone: "neutral" };
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

  if (result.nextState.selection) {
    return {
      message: `已选中 ${result.nextState.selection.gemIds.length} 颗同色宝石。`,
      tone: "selected",
    };
  }

  return { message: "选择已取消。", tone: "neutral" };
}

export function App() {
  const initialState = useMemo(() => createGameState(prismLevel), []);
  const [state, setState] = useState<GameState>(initialState);
  const [activity, setActivity] = useState("点击颜色错误的宝石开始整理。");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");

  const applyCommand = useCallback(
    (command: GameCommand) => {
      const result = reduce(state, command, initialState);
      const feedback = describeTransition(result, command);
      setState(result.nextState);
      setActivity(feedback.message);
      setFeedbackTone(feedback.tone);
    },
    [initialState, state],
  );

  const handleBoardClick = useCallback(
    (coord: Coord, cell: BoardCell) => {
      if (state.status === "won") {
        return;
      }

      if (state.selection && cell.gemId === null) {
        applyCommand({ type: "place-selection-at-target", coord });
        return;
      }

      applyCommand({ type: "select-board-gem", coord });
    },
    [applyCommand, state.selection, state.status],
  );

  const handleShelfClick = useCallback(
    (index: number, gemId: string | undefined) => {
      if (state.status === "won") {
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
    [applyCommand, state.selection?.container, state.status],
  );

  const selectedCount = state.selection?.gemIds.length ?? 0;
  const shelfFreeSlots = state.shelf.capacity - state.shelf.gemIds.length;
  const boardSlots = Array.from({ length: state.board.rows * state.board.cols }, (_, index) => {
    const coord = { row: Math.floor(index / state.board.cols), col: index % state.board.cols };
    return { coord, cell: state.board.cells[keyOf(coord)] };
  });

  return (
    <main className="game-shell" data-feedback={feedbackTone}>
      <section className="game-canvas" aria-label="Brilliant Sort 游戏">
        <header className="mobile-hud" aria-label="关卡状态">
          <div className="level-lockup">
            <span className="level-gem" aria-hidden="true" />
            <div>
              <p>BRILLIANT SORT</p>
              <h1>关卡 01</h1>
            </div>
          </div>
          <div className="hud-actions">
            <div className="hud-status" aria-live="polite">
              <span className="status-dot" aria-hidden="true" />
              <span>{state.status === "won" ? "已完成" : "整理中"}</span>
            </div>
            <button
              className="reset-control"
              type="button"
              onClick={() => applyCommand({ type: "restart-level" })}
              aria-label="重新开始关卡"
            >
              重置
            </button>
          </div>
        </header>

        <section className="puzzle-area" aria-label="宝石棋盘">
          <div className="puzzle-prompt">
            <p>把每颗宝石送回它的颜色。</p>
            <span className={selectedCount ? "selection-count is-active" : "selection-count"}>
              {selectedCount ? `已选 ${selectedCount}` : "点击开始"}
            </span>
          </div>

          <div className="board-porcelain">
            <div
              className="game-board"
              style={{ gridTemplateColumns: `repeat(${state.board.cols}, minmax(0, 1fr))` }}
            >
              {boardSlots.map(({ coord, cell }) => {
                if (!cell) {
                  return <div className="board-void" key={keyOf(coord)} aria-hidden="true" />;
                }

                const gem = cell.gemId ? state.gems[cell.gemId] : null;
                const selected = Boolean(gem && state.selection?.gemIds.includes(gem.id));
                const locked = Boolean(gem && gem.color === cell.targetColor);

                return (
                  <button
                    className={`board-cell target-${cell.targetColor}${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
                    data-testid={`board-cell-${coord.row}-${coord.col}`}
                    type="button"
                    key={keyOf(coord)}
                    onClick={() => handleBoardClick(coord, cell)}
                    aria-label={describeCell(cell, state)}
                  >
                    {gem ? (
                      <span className={`gem gem-${gem.color}`} data-locked={locked || undefined} aria-hidden="true">
                        <span className="gem-facet" />
                      </span>
                    ) : (
                      <span className="target-ring" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="activity-log" data-tone={feedbackTone} aria-live="polite">
            {activity}
          </p>
        </section>

        <section className="shelf-tray" aria-label="缓冲 Shelf">
          <div className="shelf-heading">
            <div>
              <p>缓冲槽</p>
              <span>{shelfFreeSlots} 个空位</span>
            </div>
            <div className="shelf-actions">
              {state.selection?.container === "board" ? (
                <button className="store-control" type="button" onClick={() => applyCommand({ type: "place-selection-in-shelf" })}>
                  暂存
                </button>
              ) : null}
              {state.selection ? (
                <button className="cancel-control" type="button" onClick={() => applyCommand({ type: "cancel-selection" })}>
                  取消
                </button>
              ) : null}
            </div>
          </div>
          <div className="shelf-grid" style={{ gridTemplateColumns: `repeat(${state.shelf.width}, minmax(0, 1fr))` }}>
            {Array.from({ length: state.shelf.capacity }, (_, index) => {
              const gemId = state.shelf.gemIds[index];
              const gem = gemId ? state.gems[gemId] : null;
              const selected = Boolean(gem && state.selection?.gemIds.includes(gem.id));
              return (
                <button
                  className={`shelf-slot${selected ? " is-selected" : ""}${gem ? " has-gem" : ""}`}
                  data-testid={`shelf-slot-${index}`}
                  type="button"
                  key={index}
                  onClick={() => handleShelfClick(index, gemId)}
                  aria-label={gem ? `${COLOR_LABEL[gem.color]}宝石缓冲槽` : "空缓冲槽"}
                >
                  {gem ? (
                    <span className={`gem gem-${gem.color}`} aria-hidden="true"><span className="gem-facet" /></span>
                  ) : (
                    <span className="slot-mark" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </section>

      {state.status === "won" ? (
        <div className="win-overlay" role="status" aria-live="assertive">
          <div className="win-card">
            <span className="win-mark" aria-hidden="true" />
            <p>FIELD COMPLETE</p>
            <h2>棱镜已归位</h2>
            <span>所有目标色都已匹配，缓冲槽也已清空。</span>
            <button className="play-again-control" type="button" onClick={() => applyCommand({ type: "restart-level" })}>
              再玩一次
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
