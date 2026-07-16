import type { CoreTransition, GameCommand, RejectionCode } from "../core";
import type { AudioCue } from "./contracts";
type UnsequencedAudioCue = {
  [Kind in AudioCue["kind"]]: Omit<Extract<AudioCue, { readonly kind: Kind }>, "sequence">;
}[AudioCue["kind"]];

const REJECTION_CODE: Record<RejectionCode, number> = {
  "game-won": 1,
  "no-selectable-gem": 2,
  "locked-gem": 3,
  "no-selection": 4,
  "target-color-mismatch": 5,
  "target-is-occupied": 6,
  "invalid-target": 7,
  "shelf-full": 8,
  "selection-must-come-from-board": 9,
};

interface DerivedAudioCues {
  readonly cues: readonly AudioCue[];
  readonly nextSequence: number;
}


export function deriveAudioCues(
  transition: CoreTransition,
  command: GameCommand,
  sequenceStart: number,
): DerivedAudioCues {
  let sequence = sequenceStart;
  const cues: AudioCue[] = [];
  const append = (cue: UnsequencedAudioCue) => {
    cues.push({ ...cue, sequence: sequence++ } as AudioCue);
  };

  if (transition.rejection !== null) {
    append({ kind: "rejected", code: REJECTION_CODE[transition.rejection.code] });
    return { cues, nextSequence: sequence };
  }

  if (command.type === "restart-level") {
    append({ kind: "restart" });
    return { cues, nextSequence: sequence };
  }

  const selectionChanged = transition.events.some((event) => event.type === "selection-changed");
  if (selectionChanged && transition.state.selection !== null) {
    append({
      kind: "selection",
      color: transition.state.selection.color,
      count: transition.state.selection.gemIds.length,
    });
  }

  const movedGemIds = transition.events.flatMap((event) => {
    if (event.type !== "gem-placed" || !event.detail) {
      return [];
    }
    const [gemId] = event.detail.split("->", 1);
    return gemId ? [gemId] : [];
  });
  if (movedGemIds.length > 0) {
    const color = transition.state.gems[movedGemIds[0]!]!.color;
    if (command.type === "place-selection-in-shelf") {
      append({ kind: "shelf_store", color, count: movedGemIds.length });
    } else {
      append({ kind: "target_place", color, count: movedGemIds.length });
    }

    const compacted = transition.events.filter((event) => event.type === "shelf-compacted").length;
    if (compacted > 0) {
      append({ kind: "shelf_compact", movedCount: compacted });
    }

    const cells = Object.values(transition.state.board.cells);
    const matched = cells.filter(
      (cell) =>
        cell.gemId !== null &&
        transition.state.gems[cell.gemId]?.color === cell.targetColor,
    ).length;
    append({ kind: "progress", matched, total: cells.length });
  }

  if (transition.events.some((event) => event.type === "won")) {
    append({ kind: "won" });
  }

  return { cues, nextSequence: sequence };
}
