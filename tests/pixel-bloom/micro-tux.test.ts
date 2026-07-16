import { expect, test } from "bun:test";
import { join } from "node:path";
import microPalette from "../../art/palettes/micro-tux.json";
import { readPng } from "../../src/pixel-bloom";

const variants = ["obsidian", "pearl", "amber", "navy", "ice", "coral", "jade"] as const;

function alphaMask(data: Uint8Array): number[] {
  const alpha: number[] = [];
  for (let index = 3; index < data.length; index += 4) {
    alpha.push(data[index]!);
  }
  return alpha;
}

test("promoted Micro variants retain the reviewed 32px binary Alpha geometry", async () => {
  const directory = join(process.cwd(), "src", "assets", "pixel", "micro");
  const neutral = await readPng(join(directory, "neutral.png"));
  const expectedAlpha = alphaMask(neutral.data);

  expect(neutral.width).toBe(32);
  expect(neutral.height).toBe(32);
  expect(expectedAlpha.filter((value) => value === 255)).toHaveLength(604);
  expect(expectedAlpha.filter((value) => value === 0)).toHaveLength(420);
  expect(new Set(expectedAlpha)).toEqual(new Set([0, 255]));

  for (const variant of variants) {
    const sprite = await readPng(join(directory, `${variant}.png`));
    expect({ variant, width: sprite.width, height: sprite.height }).toEqual({
      variant,
      width: 32,
      height: 32,
    });
    expect(alphaMask(sprite.data)).toEqual(expectedAlpha);
  }
});

test("the semantic manifest declares every promoted Tux color", () => {
  expect(Object.keys(microPalette.variants).sort()).toEqual(
    ["neutral", ...variants].sort(),
  );
  expect(microPalette.roles.outline.fixed).toBe(true);
  expect(microPalette.roles.specular.fixed).toBe(true);
});
