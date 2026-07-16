import { expect, test } from "bun:test";
import { createGameState } from "../src/core/level";
import type { CoreTransition } from "../src/core/port";
import type { GameState } from "../src/core/types";
import { tuxLevel } from "../src/fixtures";
import {
  calculateDioramaCameraFit,
  createDioramaInstanceIdentity,
  createDioramaLayout,
  dioramaTargetKey,
} from "../src/three/layout";
import { planDioramaTransition, sampleDioramaGemMotion } from "../src/three/motion";

function tinyState(): GameState {
  return {
    schemaVersion: 1,
    levelId: "tiny",
    board: {
      rows: 1,
      cols: 2,
      cells: {
        "0:0": { targetColor: "navy", gemId: "gem-a" },
        "0:1": { targetColor: "coral", gemId: null },
      },
    },
    gems: {
      "gem-a": { id: "gem-a", color: "navy" },
    },
    shelf: { width: 2, capacity: 2, gemIds: [] },
    selection: {
      container: "board",
      anchor: { row: 0, col: 0 },
      color: "navy",
      gemIds: ["gem-a"],
    },
    status: "playing",
  };
}

function acceptedTransition(state: GameState): CoreTransition {
  return {
    schemaVersion: 1,
    state,
    events: [{ type: "gem-placed", detail: "gem-a->shelf:0" }],
    rejection: null,
    canonicalDump: "test-only",
  };
}

test("the Tux layout represents all 546 active Board cells and every Shelf slot", () => {
  const state = createGameState(tuxLevel);
  const layout = createDioramaLayout(state, "landscape");

  expect(layout.boardCells).toHaveLength(546);
  expect(layout.shelfSlots).toHaveLength(state.shelf.capacity);
  expect(Object.keys(layout.gemPositions)).toHaveLength(546);
  expect(new Set(layout.boardCells.map((cell) => `${cell.target.x}:${cell.target.y}`)).size).toBe(546);

  const top = layout.boardCells.find((cell) => cell.coord.row === 0);
  const lower = layout.boardCells.find((cell) => cell.coord.row === 1);
  expect(top && lower && top.target.y > lower.target.y).toBe(true);
});

test("portrait recomposes both Shelf banks below the Board while landscape keeps them beside it", () => {
  const state = createGameState(tuxLevel);
  const landscape = createDioramaLayout(state, "landscape");
  const portrait = createDioramaLayout(state, "portrait");
  const boardMinY = Math.min(...portrait.boardCells.map((cell) => cell.target.y));
  const boardMinX = Math.min(...landscape.boardCells.map((cell) => cell.target.x));
  const boardMaxX = Math.max(...landscape.boardCells.map((cell) => cell.target.x));

  expect(portrait.shelfSlots.every((slot) => slot.position.y < boardMinY)).toBe(true);
  expect(new Set(portrait.shelfSlots.map((slot) => slot.position.y)).size).toBe(2);
  expect(
    landscape.shelfSlots.every(
      (slot) => slot.position.x < boardMinX || slot.position.x > boardMaxX,
    ),
  ).toBe(true);
});

test("orthographic fit preserves bounds with deterministic aspect framing", () => {
  const fit = calculateDioramaCameraFit(
    { minX: -12, maxX: 12, minY: -8, maxY: 10 },
    { width: 1280, height: 720 },
  );

  expect(fit.left).toBeLessThan(-12);
  expect(fit.right).toBeGreaterThan(12);
  expect(fit.bottom).toBeLessThan(-8);
  expect(fit.top).toBeGreaterThan(10);
  expect((fit.right - fit.left) / (fit.top - fit.bottom)).toBeCloseTo(1280 / 720, 8);
  expect(fit).toMatchObject({ near: -40, far: 80 });
});

test("stable targets and gem indices do not depend on a command's current placement", () => {
  const before = tinyState();
  const after: GameState = {
    ...before,
    board: {
      ...before.board,
      cells: {
        ...before.board.cells,
        "0:0": { ...before.board.cells["0:0"]!, gemId: null },
      },
    },
    shelf: { ...before.shelf, gemIds: ["gem-a"] },
    selection: null,
  };

  const first = createDioramaInstanceIdentity(before);
  const second = createDioramaInstanceIdentity(after);
  expect(second).toEqual(first);
  expect(dioramaTargetKey(first.boardTargets[0]!)).toBe("board:0:0");
  expect(dioramaTargetKey(first.shelfTargets[1]!)).toBe("shelf:1");
  expect(dioramaTargetKey({ kind: "gem", gemId: "gem-a" })).toBe("gem:gem-a");
});

test("accepted motion plans and their sampled transforms are deterministic", () => {
  const before = tinyState();
  const after: GameState = {
    ...before,
    board: {
      ...before.board,
      cells: {
        ...before.board.cells,
        "0:0": { ...before.board.cells["0:0"]!, gemId: null },
      },
    },
    shelf: { ...before.shelf, gemIds: ["gem-a"] },
    selection: null,
  };
  const transition = acceptedTransition(after);
  const command = { type: "place-selection-in-shelf" } as const;
  const first = planDioramaTransition(before, transition, command, "landscape");
  const second = planDioramaTransition(before, transition, command, "landscape");

  expect(first).toEqual(second);
  expect(first).toMatchObject({ kind: "placement", accepted: true, victorySweep: false });
  expect(first.gemMotions).toHaveLength(1);
  const motion = first.gemMotions[0]!;
  expect(sampleDioramaGemMotion(motion, motion.delayMs)).toEqual(motion.from);
  expect(sampleDioramaGemMotion(motion, motion.delayMs + motion.durationMs)).toEqual(motion.to);
});
