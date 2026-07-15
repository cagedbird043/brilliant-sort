import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSpritePreview,
  deriveInMemory,
  encodePng,
  inspectDecodedPng,
  parsePaletteManifest,
} from "../../src/pixel-bloom";
import type { DecodedPng } from "../../src/pixel-bloom/png";

const temporaryDirectories: string[] = [];

function createMasterSprite(): DecodedPng {
  return {
    width: 2,
    height: 2,
    data: Buffer.from([
      99, 88, 77, 0,
      1, 2, 3, 255,
      17, 34, 51, 255,
      253, 253, 253, 255,
    ]),
  };
}

function createManifest() {
  return parsePaletteManifest({
    version: 1,
    roles: {
      outline: { source: "#010203", fixed: true },
      body: { source: "#112233" },
      specular: { source: "#FDFDFD", fixed: true },
    },
    variants: {
      ice: { body: "#03C5FE" },
      jade: { body: "#36DE87" },
    },
  });
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pixel-bloom-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

test("inspect reports real transparency, opaque bounds, and a finite palette", () => {
  const inspection = inspectDecodedPng("fixture.png", createMasterSprite());

  expect(inspection.width).toBe(2);
  expect(inspection.height).toBe(2);
  expect(inspection.alpha).toEqual({ transparentPixels: 1, translucentPixels: 0, opaquePixels: 3 });
  expect(inspection.opaqueBounds).toEqual({ left: 0, top: 0, width: 2, height: 2 });
  expect(inspection.opaquePalette).toEqual(["#010203", "#112233", "#FDFDFD"]);
});

test("derive preserves Alpha and fixed roles while replacing semantic facet colors", () => {
  const source = createMasterSprite();
  const variants = deriveInMemory(source, createManifest());
  const ice = variants.get("ice");
  const jade = variants.get("jade");

  expect(ice).toBeDefined();
  expect(jade).toBeDefined();
  expect(ice?.width).toBe(source.width);
  expect(jade?.height).toBe(source.height);
  expect([...ice!.data.filter((_, index) => index % 4 === 3)]).toEqual([...source.data.filter((_, index) => index % 4 === 3)]);
  expect([...jade!.data.subarray(4, 8)]).toEqual([1, 2, 3, 255]);
  expect([...jade!.data.subarray(8, 12)]).toEqual([54, 222, 135, 255]);
  expect([...jade!.data.subarray(12, 16)]).toEqual([253, 253, 253, 255]);
});

test("derive rejects undeclared opaque source colors and translucent pixels", () => {
  const manifest = createManifest();
  const noisy = createMasterSprite();
  noisy.data.set([9, 9, 9, 255], 8);
  const translucent = createMasterSprite();
  translucent.data[7] = 128;

  expect(() => deriveInMemory(noisy, manifest)).toThrow("absent from the palette manifest");
  expect(() => deriveInMemory(translucent, manifest)).toThrow("requires binary Alpha");
});

test("manifest rejects fixed-role overrides and missing non-fixed roles", () => {
  expect(() =>
    parsePaletteManifest({
      version: 1,
      roles: { outline: { source: "#010203", fixed: true }, body: { source: "#112233" } },
      variants: { invalid: { outline: "#010203" } },
    }),
  ).toThrow("may not override fixed role outline");

  expect(() =>
    parsePaletteManifest({
      version: 1,
      roles: { body: { source: "#112233" } },
      variants: { incomplete: {} },
    }),
  ).toThrow("missing non-fixed role body");
});

test("preview writes a local pixelated review page for generated sprites", async () => {
  const directory = await createTemporaryDirectory();
  const spritesDirectory = join(directory, "sprites");
  const outputPath = join(directory, "review", "index.html");
  const source = createMasterSprite();

  await mkdir(spritesDirectory, { recursive: true });

  await Bun.write(join(spritesDirectory, "ice.png"), encodePng(source));
  await Bun.write(join(spritesDirectory, "jade.png"), encodePng(source));
  const sprites = await createSpritePreview(spritesDirectory, outputPath);
  const html = await readFile(outputPath, "utf8");

  expect(sprites.map((sprite) => sprite.fileName)).toEqual(["ice.png", "jade.png"]);
  expect(html).toContain("image-rendering: pixelated");
  expect(html).toContain("ice.png · 2×2");
  expect(html).toContain("jade.png · 2×2");
  expect(html).not.toContain("https://");
});
