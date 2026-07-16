import { expect, test } from "bun:test";
import tuxLevelJson from "../../src/fixtures/tux-01.json";
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
