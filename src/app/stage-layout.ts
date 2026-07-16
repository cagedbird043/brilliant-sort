export type StageOrientation = "side" | "stacked";

export interface StageLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly rows: number;
  readonly cols: number;
  readonly shelfCapacity: number;
}

export interface StageLayout {
  readonly orientation: StageOrientation;
  readonly boardCellSize: number;
  readonly bankCellSize: number;
  readonly bankSplitIndex: number;
  readonly directTouch: boolean;
  readonly maxZoom: number;
}

const STAGE_PADDING = 20;
const STAGE_GAP = 18;
const MAX_BANK_CELL = 72;
const MIN_BANK_CELL = 28;
const DIRECT_TOUCH_CELL = 24;

function boundedInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}

export function calculateStageLayout(input: StageLayoutInput): StageLayout {
  if (
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height) ||
    input.width <= 0 ||
    input.height <= 0 ||
    !Number.isInteger(input.rows) ||
    !Number.isInteger(input.cols) ||
    !Number.isInteger(input.shelfCapacity) ||
    input.rows <= 0 ||
    input.cols <= 0 ||
    input.shelfCapacity <= 0
  ) {
    throw new RangeError("Stage dimensions, board dimensions, and Shelf capacity must be positive");
  }

  const bankSplitIndex = Math.ceil(input.shelfCapacity / 2);
  const largestBank = Math.max(bankSplitIndex, input.shelfCapacity - bankSplitIndex);
  const usableWidth = Math.max(1, input.width - STAGE_PADDING * 2);
  const usableHeight = Math.max(1, input.height - STAGE_PADDING * 2);
  const maxBoardCell = input.rows <= 8 && input.cols <= 8 ? 88 : 40;

  const sideBankCell = boundedInteger(
    usableHeight / largestBank,
    MIN_BANK_CELL,
    MAX_BANK_CELL,
  );
  const sideBoardWidth = Math.max(1, usableWidth - sideBankCell * 2 - STAGE_GAP * 2);
  const sideBoardCell = boundedInteger(
    Math.min(sideBoardWidth / input.cols, usableHeight / input.rows),
    1,
    maxBoardCell,
  );

  const stackedBankCell = boundedInteger(
    usableWidth / largestBank,
    MIN_BANK_CELL,
    Math.min(MAX_BANK_CELL, 56),
  );
  const stackedBoardHeight = Math.max(
    1,
    usableHeight - stackedBankCell * 2 - STAGE_GAP * 2,
  );
  const stackedBoardCell = boundedInteger(
    Math.min(usableWidth / input.cols, stackedBoardHeight / input.rows),
    1,
    maxBoardCell,
  );

  let orientation: StageOrientation;
  if (sideBoardCell === stackedBoardCell) {
    orientation = input.width >= input.height ? "side" : "stacked";
  } else {
    orientation = sideBoardCell > stackedBoardCell ? "side" : "stacked";
  }
  const boardCellSize = orientation === "side" ? sideBoardCell : stackedBoardCell;
  const bankCellSize = orientation === "side" ? sideBankCell : stackedBankCell;
  const directTouch = boardCellSize >= DIRECT_TOUCH_CELL;

  return {
    orientation,
    boardCellSize,
    bankCellSize,
    bankSplitIndex,
    directTouch,
    maxZoom: directTouch ? 1 : Math.min(3, Math.max(2, Math.ceil(DIRECT_TOUCH_CELL / boardCellSize))),
  };
}
