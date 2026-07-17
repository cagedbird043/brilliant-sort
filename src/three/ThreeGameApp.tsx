import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { CoreTransition, GameCommand, GameCorePort, GameState, RejectionCode } from "../core";
import { deriveAudioCues, getBrowserPixelAudioPort, type BrowserPixelAudioPort, type PixelAudioSnapshot } from "../audio";
import { tuxLevel } from "../fixtures";
import { GameCoreFactory } from "../wasm/game-core";
import audioCrystal from "../assets/pixel/audio-crystal.svg";
import globalWand from "../assets/pixel/global-wand.svg";
import replayLevel from "../assets/pixel/replay-level.svg";
import type { DioramaRendererFactory, DioramaRendererPort, DioramaTarget } from "./contracts";
import { targetToCommand } from "./interaction";

export interface ThreeGameAppProps {
  readonly createRenderer: DioramaRendererFactory;
}

type FeedbackTone = "neutral" | "rejected" | "placed" | "won";

interface Feedback {
  readonly message: string;
  readonly tone: FeedbackTone;
}

const REJECTION_MESSAGES: Record<RejectionCode, string> = {
  "game-won": "The level is complete.",
  "no-selectable-gem": "No movable gem here.",
  "locked-gem": "This gem is fixed.",
  "no-selection": "Select a gem first.",
  "target-color-mismatch": "That target does not match.",
  "target-is-occupied": "That target is occupied.",
  "invalid-target": "That target is unavailable.",
  "shelf-full": "The Shelf is full.",
  "selection-must-come-from-board": "Only Board selections enter the Shelf.",
};

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", update);
    } else if (typeof query.addListener === "function") {
      query.addListener(update);
    }
    return () => {
      if (typeof query.removeEventListener === "function") {
        query.removeEventListener("change", update);
      } else if (typeof query.removeListener === "function") {
        query.removeListener(update);
      }
    };
  }, []);

  return reducedMotion;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function transitionFeedback(transition: CoreTransition, command: GameCommand): Feedback {
  if (transition.rejection !== null) {
    return {
      tone: "rejected",
      message: REJECTION_MESSAGES[transition.rejection.code] ?? transition.rejection.detail,
    };
  }
  if (command.type === "restart-level") {
    return { tone: "neutral", message: "Reset." };
  }
  if (transition.events.some((event) => event.type === "won")) {
    return { tone: "won", message: "Complete." };
  }
  if (transition.events.some((event) => event.type === "gem-placed")) {
    return { tone: "placed", message: "Placed." };
  }
  if (transition.events.some((event) => event.type === "selection-changed")) {
    return { tone: "neutral", message: "Selected." };
  }
  return { tone: "neutral", message: "Ready." };
}

function targetForCommand(command: GameCommand): DioramaTarget | null {
  switch (command.type) {
    case "select-board-gem":
      return { kind: "board", coord: command.coord };
    case "place-selection-at-target":
      return { kind: "board", coord: command.coord };
    case "select-shelf-gem":
      return { kind: "shelf", index: command.index };
    case "place-selection-in-shelf":
      return { kind: "shelf", index: 0 };
    default:
      return null;
  }
}


export function ThreeGameApp({ createRenderer }: ThreeGameAppProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<GameCorePort | null>(null);
  const rendererRef = useRef<DioramaRendererPort | null>(null);
  const audioPortRef = useRef<BrowserPixelAudioPort | null>(null);
  const audioSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const inputLockedRef = useRef(false);
  const stateRef = useRef<GameState | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [inputLocked, setInputLocked] = useState(false);
  const [focusedTarget, setFocusedTarget] = useState<DioramaTarget | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [audioSnapshot, setAudioSnapshot] = useState<PixelAudioSnapshot>({
    status: "loading",
    muted: false,
  });
  const reducedMotion = useReducedMotion();

  const lockInput = useCallback((locked: boolean) => {
    inputLockedRef.current = locked;
    if (mountedRef.current) {
      setInputLocked(locked);
    }
  }, []);

  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next);
    if (feedbackTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(feedbackTimerRef.current);
    }
    if (typeof window !== "undefined") {
      feedbackTimerRef.current = window.setTimeout(() => {
        feedbackTimerRef.current = null;
        if (mountedRef.current) {
          setFeedback(null);
        }
      }, next.tone === "rejected" ? 1200 : 850);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (feedbackTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const audio = getBrowserPixelAudioPort();
    audioPortRef.current = audio;
    setAudioSnapshot(audio.snapshot());
    const unsubscribe = audio.subscribe(setAudioSnapshot);
    void audio.prepare();
    return () => {
      unsubscribe();
      if (audioPortRef.current === audio) {
        audioPortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    let cancelled = false;
    let renderer: DioramaRendererPort | null = null;
    stateRef.current = null;
    setState(null);
    setBootError(null);
    setFeedback(null);
    lockInput(false);

    try {
      renderer = createRenderer(canvas, {
        onContextLost: (message) => {
          if (!cancelled) {
            setBootError(message || "WebGL context lost.");
            lockInput(true);
          }
        },
      });
      rendererRef.current = renderer;
      renderer.setReducedMotion(reducedMotion);
    } catch (error: unknown) {
      setBootError(errorMessage(error, "Unable to create the WebGL diorama."));
      return;
    }

    const bridge = {
      snapshot: () => renderer!.snapshotDiagnostics(),
      projectTarget: (target: DioramaTarget) => renderer!.projectTarget(target),
      setPresentationTimeForTest: (timeMs: number | null) => {
        renderer!.setPresentationTimeForTest(timeMs);
      },
    };
    if (typeof window !== "undefined") {
      window.__BRILLIANT_SORT_3D__ = bridge;
    }

    void GameCoreFactory.load(tuxLevel)
      .then((core) => {
        if (cancelled) {
          core.destroy();
          return;
        }
        coreRef.current = core;
        const snapshot = core.snapshot();
        stateRef.current = snapshot;
        setState(snapshot);
        renderer?.renderState(snapshot);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBootError(errorMessage(error, "Unable to load the WebAssembly game core."));
        }
      });

    return () => {
      cancelled = true;
      lockInput(false);
      coreRef.current?.destroy();
      coreRef.current = null;
      if (typeof window !== "undefined" && window.__BRILLIANT_SORT_3D__ === bridge) {
        delete window.__BRILLIANT_SORT_3D__;
      }
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
      renderer?.dispose();
    };
  }, [bootAttempt, createRenderer, lockInput]);

  const applyCommand = useCallback(
    (command: GameCommand, pickedTarget: DioramaTarget | null = null) => {
      const core = coreRef.current;
      const renderer = rendererRef.current;
      const currentState = stateRef.current;
      if (core === null || currentState === null || inputLockedRef.current) {
        return;
      }
      if (currentState.status === "won" && command.type !== "restart-level") {
        return;
      }

      audioPortRef.current?.resumeFromGesture();
      renderer?.renderState(currentState);

      let transition: CoreTransition;
      try {
        transition = core.dispatch(command);
      } catch (error: unknown) {
        renderer?.reject(pickedTarget ?? targetForCommand(command));
        showFeedback({ tone: "rejected", message: errorMessage(error, "Core communication failed.") });
        return;
      }

      const audio = deriveAudioCues(transition, command, audioSequenceRef.current);
      audioSequenceRef.current = audio.nextSequence;
      for (const cue of audio.cues) {
        audioPortRef.current?.pushCue(cue);
      }

      const nextState = transition.state;
      stateRef.current = nextState;
      setState(nextState);
      const nextFeedback = transitionFeedback(transition, command);
      showFeedback(nextFeedback);

      if (transition.rejection !== null) {
        renderer?.reject(pickedTarget ?? targetForCommand(command));
        return;
      }

      lockInput(true);
      if (command.type === "restart-level") {
        renderer?.resetCamera();
      }

      let motion: Promise<void>;
      try {
        motion = renderer?.playTransition(currentState, transition, command) ?? Promise.resolve();
      } catch (error: unknown) {
        motion = Promise.reject(error);
      }

      void motion
        .then(() => {
          if (!mountedRef.current) {
            return;
          }
          renderer?.renderState(nextState);
          if (command.type === "restart-level") {
            renderer?.resetCamera();
          }
        })
        .catch((error: unknown) => {
          if (mountedRef.current) {
            renderer?.renderState(nextState);
            showFeedback({ tone: "rejected", message: errorMessage(error, "Diorama transition failed.") });
          }
        })
        .finally(() => lockInput(false));
    },
    [lockInput, showFeedback],
  );

  const activateTarget = useCallback(
    (target: DioramaTarget) => {
      setFocusedTarget(target);
      rendererRef.current?.focus(target);
      const currentState = stateRef.current;
      if (currentState === null || currentState.status === "won" || inputLockedRef.current) {
        return;
      }
      const command = targetToCommand(target, currentState);
      if (command === null) {
        rendererRef.current?.reject(target);
        showFeedback({ tone: "rejected", message: "No action for this target." });
        return;
      }
      applyCommand(command, target);
    },
    [applyCommand, showFeedback],
  );

  const focusTarget = useCallback((target: DioramaTarget) => {
    setFocusedTarget(target);
    rendererRef.current?.focus(target);
  }, []);

  const handleCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      if (inputLockedRef.current) {
        return;
      }
      const pick = rendererRef.current?.pick(event.clientX, event.clientY);
      if (pick === null || pick === undefined) {
        setFocusedTarget(null);
        rendererRef.current?.focus(null);
        return;
      }
      activateTarget(pick.target);
    },
    [activateTarget],
  );

  const handleMute = useCallback(() => {
    const audio = audioPortRef.current;
    if (audio === null) {
      return;
    }
    audio.resumeFromGesture();
    audio.setMuted(!audio.snapshot().muted);
  }, []);

  const handleRetry = useCallback(() => {
    lockInput(false);
    setBootError(null);
    setBootAttempt((attempt) => attempt + 1);
  }, [lockInput]);

  const boardCells = state === null
    ? []
    : Object.entries(state.board.cells).sort(([left], [right]) => {
        const [leftRow, leftCol] = left.split(":").map(Number);
        const [rightRow, rightCol] = right.split(":").map(Number);
        return leftRow - rightRow || leftCol - rightCol;
      });
  const shelfSlots = state === null ? [] : Array.from({ length: state.shelf.capacity }, (_, index) => index);
  const semanticDisabled = state === null || state.status === "won";
  const gameplayDisabled = semanticDisabled || inputLocked;
  const statusLabel = state === null ? (bootError === null ? "BOOT" : "ERROR") : state.status;

  return (
    <main className="three-game-shell" data-testid="three-stage">
      <section className="three-stage" aria-label="Three-dimensional game stage">
        <canvas
          key={bootAttempt}
          ref={canvasRef}
          className="three-canvas"
          data-testid="three-canvas"
          aria-label="Interactive diorama"
          onPointerUp={handleCanvasPointerUp}
        />

        <div className="three-semantic-controls" data-testid="three-semantic-controls">
          <div className="three-board-controls" aria-label="Board controls">
            {boardCells.map(([cellKey, cell]) => {
              const [row, col] = cellKey.split(":").map(Number);
              const gemId = cell.gemId;
              const gem = gemId === null ? null : state?.gems[gemId] ?? null;
              const selected = gemId !== null && state?.selection?.gemIds.includes(gemId) === true;
              const locked = gem !== null && gem.color === cell.targetColor;
              const target: DioramaTarget = { kind: "board", coord: { row, col } };
              const style: CSSProperties = {
                gridColumnStart: col + 1,
                gridRowStart: row + 1,
              };
              return (
                <button
                  key={cellKey}
                  type="button"
                  className={`three-target-control${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
                  style={style}
                  data-testid={`three-board-cell-${row}-${col}`}
                  aria-label={`Board ${row + 1}, ${col + 1}`}
                  aria-pressed={selected}
                  aria-disabled={gameplayDisabled || locked}
                  disabled={semanticDisabled || locked}
                  onFocus={() => focusTarget(target)}
                  onClick={() => activateTarget(target)}
                />
              );
            })}
          </div>

          <div className="three-shelf-controls" aria-label="Shelf controls">
            {shelfSlots.map((index) => {
              const gemId = state?.shelf.gemIds[index];
              const selected = gemId !== undefined && state?.selection?.gemIds.includes(gemId) === true;
              const target: DioramaTarget = { kind: "shelf", index };
              return (
                <button
                  key={index}
                  type="button"
                  className={`three-target-control${selected ? " is-selected" : ""}`}
                  data-testid={`three-shelf-slot-${index}`}
                  aria-label={`Shelf ${index + 1}${gemId === undefined ? " empty" : " occupied"}`}
                  aria-pressed={selected}
                  aria-disabled={gameplayDisabled}
                  disabled={semanticDisabled}
                  onFocus={() => focusTarget(target)}
                  onClick={() => activateTarget(target)}
                />
              );
            })}
          </div>
        </div>

        <nav className="three-rail" aria-label="Game controls">
          <button
            type="button"
            className="three-icon-control three-mute-control"
            data-testid="mute-audio"
            data-audio-status={audioSnapshot.status}
            aria-label={audioSnapshot.muted ? "Unmute audio" : "Mute audio"}
            aria-pressed={audioSnapshot.muted}
            disabled={audioSnapshot.status === "failed"}
            onClick={handleMute}
          >
            <img className="three-icon-glyph" src={audioCrystal} alt="" aria-hidden="true" />
          </button>
          {state?.status === "won" ? (
            <button
              type="button"
              className="three-icon-control three-replay-control"
              data-testid="replay-level"
              aria-label="Replay level"
              disabled={inputLocked}
              onClick={() => applyCommand({ type: "restart-level" })}
            >
              <img className="three-icon-glyph" src={replayLevel} alt="" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="three-icon-control three-wand-control"
              data-testid="global-wand"
              aria-label="Apply global wand"
              disabled={gameplayDisabled}
              onClick={() => applyCommand({ type: "apply-global-wand" })}
            >
              <img className="three-icon-glyph" src={globalWand} alt="" aria-hidden="true" />
            </button>
          )}
        </nav>

        <div className="three-status" data-testid="three-status" data-state={state?.status ?? "boot"} role="status" aria-live="polite">
          {statusLabel}
        </div>

        {feedback !== null && (
          <div className="three-feedback" data-testid="three-feedback" data-tone={feedback.tone} role="status" aria-live="polite">
            {feedback.message}
          </div>
        )}

        {state === null && bootError === null && (
          <div className="three-boot" data-testid="three-boot" role="status" aria-busy="true">
            Loading
          </div>
        )}

        {bootError !== null && (
          <div className="three-error-panel" data-testid="three-error" role="alert">
            <p className="three-error-message">{bootError}</p>
            <button type="button" className="three-icon-control three-retry-control" data-testid="three-retry" aria-label="Retry" onClick={handleRetry}>
              <span className="three-icon-glyph" aria-hidden="true">↻</span>
            </button>
          </div>
        )}

        {focusedTarget !== null && (
          <span className="visually-hidden" aria-live="polite">
            Focused target
          </span>
        )}
      </section>
    </main>
  );
}
