import { expect, test } from "bun:test";
import chromeLevelJson from "../../src/fixtures/chrome-01.json";
import tuxLevelJson from "../../src/fixtures/tux-01.json";
import chromeMapJson from "../../src/fixtures/source/chrome-01.map.json";
import tuxMapJson from "../../src/fixtures/source/tux-01.map.json";
import { compileLevelMap, serializeLevelSpec } from "../../tools/compile-level-map";

test("the compact Tux map compiles byte-for-byte to the committed LevelSpec", () => {
  const compiled = compileLevelMap(tuxMapJson);
  const matched = compiled.cells.filter((cell) => cell.gem.color === cell.targetColor).length;

  expect(serializeLevelSpec(compiled)).toBe(`${JSON.stringify(tuxLevelJson, null, 2)}\n`);
  expect(compiled.cells).toHaveLength(546);
  expect(matched).toBe(410);
  expect(compiled.shelfCapacity).toBe(16);
  expect(compiled.cells[0]).toEqual({
    row: 0,
    col: 9,
    targetColor: "obsidian",
    gem: { id: "tux-01-r00-c09", color: "obsidian" },
  });
  expect(compiled.cells.at(-1)).toEqual({
    row: 31,
    col: 21,
    targetColor: "obsidian",
    gem: { id: "tux-01-r31-c21", color: "obsidian" },
  });
});

test("the map compiler rejects mask drift and per-color imbalance", () => {
  const maskDrift = structuredClone(tuxMapJson);
  maskDrift.gems[0] = `${maskDrift.gems[0]!.slice(0, 9)}.${maskDrift.gems[0]!.slice(10)}`;

  const imbalanced = structuredClone(tuxMapJson);
  imbalanced.gems[0] = `${imbalanced.gems[0]!.slice(0, 9)}P${imbalanced.gems[0]!.slice(10)}`;

  expect(() => compileLevelMap(maskDrift)).toThrow("target/gem masks differ at 0:9");
  expect(() => compileLevelMap(imbalanced)).toThrow("color conservation failed");
});

test("the compact Chrome map compiles byte-for-byte to the committed LevelSpec", () => {
  const compiled = compileLevelMap(chromeMapJson);
  const targetCounts: Record<string, number> = {};
  for (const cell of compiled.cells) {
    targetCounts[cell.targetColor] = (targetCounts[cell.targetColor] ?? 0) + 1;
  }
  const matched = compiled.cells.filter((cell) => cell.gem.color === cell.targetColor).length;

  expect(serializeLevelSpec(compiled)).toBe(`${JSON.stringify(chromeLevelJson, null, 2)}\n`);
  expect(compiled.rows).toBe(32);
  expect(compiled.cols).toBe(32);
  expect(compiled.cells).toHaveLength(562);
  expect(targetCounts).toEqual({
    coral: 154,
    amber: 154,
    jade: 158,
    navy: 96,
  });
  expect(matched).toBe(422);
  expect(compiled.shelfCapacity).toBe(16);
  expect(compiled.cells[0]).toEqual({
    row: 1,
    col: 13,
    targetColor: "coral",
    gem: { id: "chrome-01-r01-c13", color: "amber" },
  });
  expect(compiled.cells.at(-1)).toEqual({
    row: 30,
    col: 18,
    targetColor: "amber",
    gem: { id: "chrome-01-r30-c18", color: "amber" },
  });
});

test("the Chrome map compiler rejects a fifth color, mask drift, and per-color imbalance", () => {
  const fifthColor = structuredClone(chromeMapJson) as unknown as {
    palette: Record<string, unknown>;
  };
  fifthColor.palette.V = "violet";

  const maskDrift = structuredClone(chromeMapJson);
  maskDrift.gems[1] = `${maskDrift.gems[1]!.slice(0, 13)}.${maskDrift.gems[1]!.slice(14)}`;

  const imbalanced = structuredClone(chromeMapJson);
  imbalanced.gems[1] = `${imbalanced.gems[1]!.slice(0, 13)}C${imbalanced.gems[1]!.slice(14)}`;

  expect(() => compileLevelMap(fifthColor)).toThrow("palette symbol V uses unsupported color");
  expect(() => compileLevelMap(maskDrift)).toThrow("target/gem masks differ at 1:13");
  expect(() => compileLevelMap(imbalanced)).toThrow("color conservation failed");
});
