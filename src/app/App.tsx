import { useCallback, useMemo, useState } from "react";
import { keyOf } from "../core/coords";
import { createGameState } from "../core/level";
import { reduce } from "../core/reducer";
import type { BoardCell, Coord, GameCommand, GameState } from "../core/types";
import { prismLevel } from "../fixtures";

const COLOR_LABEL: Record<string, string> = {
  navy: "深蓝",
  ice: "冰蓝",
  coral: "珊瑚红",
  jade: "翡翠绿",
};

function describeCell(cell: BoardCell, state: GameState): string {
  if (!cell.gemId) {
    return `${COLOR_LABEL[cell.targetColor]}目标空位`;
  }

  const gem = state.gems[cell.gemId];
  const status = gem.color === cell.targetColor ? "已固定" : "可移动";
  return `${COLOR_LABEL[gem.color]}宝石，${COLOR_LABEL[cell.targetColor]}目标，${status}`;
}

export function App() {
  const initialState = useMemo(() => createGameState(prismLevel), []);
  const [state, setState] = useState<GameState>(initialState);
  const [activity, setActivity] = useState("选择一组颜色错误的宝石开始整理。");

  const applyCommand = useCallback(
    (command: GameCommand) => {
      const result = reduce(state, command, initialState);
      setState(result.nextState);

      if (result.rejection) {
        setActivity(result.rejection.detail);
        return;
      }

      const eventText = result.events.map((event) => event.detail ?? event.type).join(" · ");
      setActivity(eventText || "状态没有变化。");
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
  const boardSlots = Array.from({ length: state.board.rows * state.board.cols }, (_, index) => {
    const coord = { row: Math.floor(index / state.board.cols), col: index % state.board.cols };
    return { coord, cell: state.board.cells[keyOf(coord)] };
  });

  return (
    <main className="game-shell">
      <header className="topbar" aria-label="游戏状态">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">DETERMINISTIC PUZZLE / 01</p>
            <h1>Brilliant Sort</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="status-chip" aria-live="polite">
            <span>状态</span>
            <strong>{state.status === "won" ? "已完成" : "整理中"}</strong>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => applyCommand({ type: "restart-level" })}
            aria-label="重新开始关卡"
            title="重新开始"
          >
            重置
          </button>
        </div>
      </header>

      <section className="play-surface" aria-label="Brilliant Sort 棋盘">
        <aside className="rule-panel" aria-label="本局规则">
          <p className="panel-kicker">PRISM / 01</p>
          <h2>让每颗宝石归位。</h2>
          <ol>
            <li>点击颜色错误的连通宝石。</li>
            <li>把它们送到同色空格或缓冲槽。</li>
            <li>棋盘全匹配、缓冲槽清空即获胜。</li>
          </ol>
          <div className="selection-readout">
            <span>当前选择</span>
            <strong>{selectedCount ? `${selectedCount} 颗` : "未选择"}</strong>
          </div>
        </aside>

        <div className="board-stage">
          <div className="stage-heading">
            <div>
              <p className="panel-kicker">TARGET FIELD</p>
              <h2>棱镜信号板</h2>
            </div>
            <p>{state.selection ? "选中后点击同色空格批量归位" : "锁定宝石不可再次移动"}</p>
          </div>

          <div
            className="game-board"
            style={{ gridTemplateColumns: `repeat(${state.board.cols}, minmax(0, 1fr))` }}
            aria-label="宝石棋盘"
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

          <p className="activity-log" aria-live="polite">{activity}</p>
        </div>
      </section>

      <section className="shelf-section" aria-label="缓冲 Shelf">
        <div className="shelf-heading">
          <div>
            <p className="panel-kicker">BUFFER / {state.shelf.capacity}</p>
            <h2>缓冲槽</h2>
          </div>
          <div className="shelf-actions">
            {state.selection?.container === "board" ? (
              <button className="secondary-button" type="button" onClick={() => applyCommand({ type: "place-selection-in-shelf" })}>
                放入缓冲槽
              </button>
            ) : null}
            {state.selection ? (
              <button className="text-button" type="button" onClick={() => applyCommand({ type: "cancel-selection" })}>
                取消选择
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
                {gem ? <span className={`gem gem-${gem.color}`} aria-hidden="true"><span className="gem-facet" /></span> : <span className="slot-mark" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      {state.status === "won" ? (
        <div className="win-overlay" role="status" aria-live="assertive">
          <div className="win-card">
            <span className="win-mark" aria-hidden="true" />
            <p className="panel-kicker">FIELD STABILIZED</p>
            <h2>棱镜已归位</h2>
            <p>所有目标色都已匹配，缓冲槽也已清空。</p>
            <button className="primary-button" type="button" onClick={() => applyCommand({ type: "restart-level" })}>
              再玩一次
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
