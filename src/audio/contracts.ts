/**
 * Presentation-only 12-byte little-endian packet accepted by PixelAudioEngine.
 * This module deliberately knows nothing about GameState or game commands.
 */
export const AUDIO_CUE_PACKET_BYTES = 12;

export const audioCueKinds = {
  selection: 0,
  shelf_store: 1,
  target_place: 2,
  shelf_compact: 3,
  rejected: 4,
  progress: 5,
  won: 6,
} as const;

export const audioCueColors = {
  obsidian: 0,
  pearl: 1,
  amber: 2,
  navy: 3,
  ice: 4,
  coral: 5,
  none: 0xff,
} as const;

export type AudioCueColor = Exclude<keyof typeof audioCueColors, "none">;

interface AudioCueBase {
  /** Strictly increasing sequence supplied by the presentation bridge. */
  readonly sequence: number;
}

export interface SelectionAudioCue extends AudioCueBase {
  readonly kind: "selection";
  readonly color: AudioCueColor;
  readonly count: number;
}

export interface ShelfStoreAudioCue extends AudioCueBase {
  readonly kind: "shelf_store";
  readonly color: AudioCueColor;
  readonly count: number;
}

export interface TargetPlaceAudioCue extends AudioCueBase {
  readonly kind: "target_place";
  readonly color: AudioCueColor;
  readonly count: number;
}

export interface ShelfCompactAudioCue extends AudioCueBase {
  readonly kind: "shelf_compact";
  readonly movedCount: number;
}

export interface RejectedAudioCue extends AudioCueBase {
  readonly kind: "rejected";
  readonly code: number;
}

export interface ProgressAudioCue extends AudioCueBase {
  readonly kind: "progress";
  readonly matched: number;
  readonly total: number;
}

export interface WonAudioCue extends AudioCueBase {
  readonly kind: "won";
}

export type AudioCue =
  | SelectionAudioCue
  | ShelfStoreAudioCue
  | TargetPlaceAudioCue
  | ShelfCompactAudioCue
  | RejectedAudioCue
  | ProgressAudioCue
  | WonAudioCue;

function uint16(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${field} must be an unsigned 16-bit integer`);
  }
  return value;
}

function uint32(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`${field} must be an unsigned 32-bit integer`);
  }
  return value;
}

/** Writes one ABI packet without deriving, dispatching, or mutating gameplay. */
export function writeAudioCue(
  target: DataView,
  byteOffset: number,
  cue: AudioCue,
): void {
  if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 ||
      byteOffset + AUDIO_CUE_PACKET_BYTES > target.byteLength) {
    throw new RangeError("Audio cue packet does not fit in target DataView");
  }

  let color = audioCueColors.none;
  let primary = 0;
  let secondary = 0;
  switch (cue.kind) {
    case "selection":
    case "shelf_store":
    case "target_place":
      color = audioCueColors[cue.color];
      primary = uint16(cue.count, "count");
      break;
    case "shelf_compact":
      primary = uint16(cue.movedCount, "movedCount");
      break;
    case "rejected":
      primary = uint16(cue.code, "code");
      break;
    case "progress":
      primary = uint16(cue.matched, "matched");
      secondary = uint16(cue.total, "total");
      break;
    case "won":
      break;
  }

  target.setUint32(byteOffset, uint32(cue.sequence, "sequence"), true);
  target.setUint8(byteOffset + 4, audioCueKinds[cue.kind]);
  target.setUint8(byteOffset + 5, color);
  target.setUint16(byteOffset + 6, primary, true);
  target.setUint16(byteOffset + 8, secondary, true);
  target.setUint16(byteOffset + 10, 0, true);
}

export function encodeAudioCue(cue: AudioCue): Uint8Array {
  const bytes = new Uint8Array(AUDIO_CUE_PACKET_BYTES);
  writeAudioCue(new DataView(bytes.buffer), 0, cue);
  return bytes;
}
