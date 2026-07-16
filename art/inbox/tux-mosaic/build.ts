import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PNG } from "pngjs";

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];
type TuxMap = {
  readonly width: number;
  readonly height: number;
  readonly palette: Record<string, string>;
  readonly targets: readonly string[];
  readonly gems: readonly string[];
  readonly stats: {
    readonly active: number;
    readonly matches: number;
    readonly mismatches: number;
    readonly matchedRatio: number;
    readonly targetColorCounts: Record<string, number>;
  };
};
type PaletteManifest = {
  readonly roles: Record<string, { readonly source: string; readonly fixed?: boolean }>;
  readonly variants: Record<string, Record<string, string>>;
};

type ResolvedVariant = Record<string, string>;

const root = resolve(process.cwd());
const mapPath = resolve(root, "art/inbox/tux-mosaic/tux-01.map.json");
const palettePath = resolve(root, "art/palettes/micro-tux.json");
const masterPath = resolve(root, "art/inbox/tux-mosaic/micro-master.png");
const reviewDirectory = resolve(root, "art/review/tux-mosaic");
const mapScale = 12;

const hexToRgba = (hex: string, alpha = 255): Rgba => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
  alpha,
];

function setPixel(image: PNG, x: number, y: number, color: Rgba): void {
  if (x < 0 || x >= image.width || y < 0 || y >= image.height) return;
  const offset = (y * image.width + x) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = color[3];
}

function fillRect(image: PNG, left: number, top: number, width: number, height: number, color: Rgba): void {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) setPixel(image, x, y, color);
  }
}


function resolvedVariant(manifest: PaletteManifest, name: string): ResolvedVariant {
  const variant = manifest.variants[name];
  if (!variant) throw new Error(`Unknown Micro variant ${name}`);
  const output: ResolvedVariant = {};
  for (const [roleName, role] of Object.entries(manifest.roles)) {
    output[roleName] = role.fixed ? role.source : variant[roleName]!;
  }
  return output;
}

function createTransparentPng(width: number, height: number): PNG {
  const image = new PNG({ width, height, colorType: 6, inputHasAlpha: true });
  image.data.fill(0);
  return image;
}

function writePng(path: string, image: PNG): Promise<void> {
  return Bun.write(path, PNG.sync.write(image, { colorType: 6, inputHasAlpha: true })).then(() => undefined);
}

function buildMicroMaster(manifest: PaletteManifest): PNG {
  const image = createTransparentPng(32, 32);
  const colors = Object.fromEntries(
    Object.entries(manifest.roles).map(([roleName, role]) => [roleName, hexToRgba(role.source)]),
  ) as Record<string, Rgba>;

  const silhouette: readonly (readonly [number, number])[] = [
    [14, 17], [12, 19], [10, 21], [8, 23], [7, 24], [6, 25], [5, 26], [4, 27], [3, 28], [3, 28],
    [2, 29], [2, 29], [2, 29], [2, 29], [2, 29], [2, 29], [2, 29], [2, 29], [2, 29], [3, 28],
    [3, 28], [4, 27], [5, 26], [6, 25], [7, 24], [8, 23], [10, 21], [12, 19], [14, 17],
  ];

  for (let index = 0; index < silhouette.length; index += 1) {
    const y = index + 3;
    const [left, right] = silhouette[index]!;
    for (let x = left; x <= right; x += 1) setPixel(image, x, y, colors.outline!);
    if (right - left < 2) continue;

    const innerLeft = left + 1;
    const innerRight = right - 1;
    const center = Math.floor((innerLeft + innerRight) / 2);
    for (let x = innerLeft; x <= innerRight; x += 1) {
      const role = x <= center - 4 ? "darkFacet" : x <= center - 1 ? "midFacet" : x <= center + 2 ? "mainFacet" : "lightFacet";
      setPixel(image, x, y, colors[role]!);
    }
  }

  const diagonalHighlights: readonly (readonly [number, number])[] = [
    [14, 6], [13, 7], [12, 8], [11, 9], [10, 10],
    [15, 6], [16, 7], [17, 8],
  ];
  for (const [x, y] of diagonalHighlights) setPixel(image, x, y, colors.colorHighlight!);
  for (const [x, y] of [[15, 7], [16, 7], [15, 8]] as const) setPixel(image, x, y, colors.specular!);
  for (const [x, y] of [[12, 10], [13, 10], [12, 11], [13, 11]] as const) setPixel(image, x, y, colors.mainFacet!);
  for (const [x, y] of [[21, 14], [22, 15], [23, 16], [24, 17]] as const) setPixel(image, x, y, colors.colorHighlight!);
  for (const [x, y] of [[8, 23], [9, 24], [10, 25], [11, 26]] as const) setPixel(image, x, y, colors.shadow!);
  return image;
}

function mapColorName(map: TuxMap, symbol: string): string {
  const colorName = map.palette[symbol];
  if (!colorName) throw new Error(`Map symbol ${JSON.stringify(symbol)} is not declared`);
  return colorName;
}

function drawMapCell(
  image: PNG,
  map: TuxMap,
  targetSymbol: string,
  gemSymbol: string,
  x: number,
  y: number,
): void {
  const targetName = mapColorName(map, targetSymbol);
  const gemName = mapColorName(map, gemSymbol);
  const target = resolvedVariants[targetName]!;
  const gem = resolvedVariants[gemName]!;
  const matched = targetSymbol === gemSymbol;
  const left = x * mapScale;
  const top = y * mapScale;

  fillRect(image, left, top, mapScale, mapScale, hexToRgba(target.outline!));
  if (matched) {
    fillRect(image, left + 1, top + 1, mapScale - 2, mapScale - 2, hexToRgba(gem.mainFacet!));
    fillRect(image, left + 1, top + 1, mapScale - 2, 2, hexToRgba(gem.colorHighlight!));
    fillRect(image, left + 1, top + 1, 2, mapScale - 2, hexToRgba(gem.lightFacet!));
    return;
  }

  // A movable gem stays inset so the target-colored socket rim is visible.
  fillRect(image, left + 1, top + 1, mapScale - 2, mapScale - 2, hexToRgba(target.shadow!));
  fillRect(image, left + 3, top + 3, mapScale - 6, mapScale - 6, hexToRgba(gem.mainFacet!));
  fillRect(image, left + 3, top + 3, mapScale - 6, 1, hexToRgba(gem.colorHighlight!));
  fillRect(image, left + 3, top + 3, 1, mapScale - 6, hexToRgba(gem.lightFacet!));
  fillRect(image, left + mapScale - 2, top + 1, 1, mapScale - 2, hexToRgba(resolvedVariants.coral!.mainFacet!));
}

function buildMapPreview(map: TuxMap, opening: boolean): PNG {
  const image = createTransparentPng(map.width * mapScale, map.height * mapScale);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const targetSymbol = map.targets[y]![x]!;
      if (targetSymbol === ".") continue;
      const gemSymbol = opening ? map.gems[y]![x]! : targetSymbol;
      drawMapCell(image, map, targetSymbol, gemSymbol, x, y);
    }
  }
  return image;
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character]!);
}

function buildReviewHtml(map: TuxMap, variantNames: readonly string[]): string {
  const counts = Object.entries(map.stats.targetColorCounts)
    .map(([symbol, count]) => `<span class="count"><b>${htmlEscape(map.palette[symbol]!)}</b> ${count}</span>`)
    .join("");
  const variants = variantNames.map((name) => `
        <article class="variant-card">
          <h3>${htmlEscape(name)}</h3>
          <div class="variant-samples">
            <figure><img src="micro/${htmlEscape(name)}.png" width="32" height="32" alt="${htmlEscape(name)} Micro gem at one times scale" /><figcaption>1×</figcaption></figure>
            <figure><img class="double" src="micro/${htmlEscape(name)}.png" width="64" height="64" alt="${htmlEscape(name)} Micro gem at two times scale" /><figcaption>2×</figcaption></figure>
          </div>
        </article>`).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tux mosaic · Micro art review</title>
    <style>
      :root {
        color-scheme: dark;
        --ink: #e9edf4;
        --muted: #aab4c6;
        --cavern: #0c111b;
        --slate: #172131;
        --slate-2: #202d42;
        --line: #3a4a63;
        --accent: #ffc15a;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; padding: clamp(1rem, 4vw, 3rem); background: var(--cavern); color: var(--ink); }
      main { width: min(100%, 76rem); margin: 0 auto; }
      header { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: .75rem 2rem; margin-bottom: 1.5rem; }
      h1 { margin: 0; font-size: clamp(1.15rem, 3vw, 1.8rem); letter-spacing: .06em; }
      h2 { margin: 0 0 .75rem; font-size: .95rem; letter-spacing: .1em; text-transform: uppercase; }
      h3 { margin: 0; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
      p { max-width: 62rem; margin: .5rem 0 0; color: var(--muted); line-height: 1.6; font-size: .8rem; }
      section { margin-top: 1.75rem; }
      .proof { display: flex; flex-wrap: wrap; gap: .45rem; align-items: center; color: var(--muted); font-size: .72rem; }
      .proof strong { color: var(--accent); }
      .count { padding: .25rem .5rem; border: 1px solid var(--line); border-radius: .25rem; background: var(--slate); }
      .map-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
      .map-card, .variant-card, .source-card { margin: 0; padding: .8rem; border: 1px solid var(--line); background: var(--slate); }
      .map-card figcaption, .source-card figcaption { margin-top: .65rem; color: var(--muted); font-size: .72rem; line-height: 1.45; }
      .map-stage { display: grid; place-items: center; overflow: auto; padding: .5rem; background: repeating-conic-gradient(#202d42 0 25%, #172131 0 50%) 50% / 1rem 1rem; }
      .map-stage img { display: block; width: min(100%, 25rem); height: auto; image-rendering: pixelated; }
      .legend { display: flex; flex-wrap: wrap; gap: .65rem 1rem; margin-top: .8rem; color: var(--muted); font-size: .7rem; }
      .legend-item { display: inline-flex; align-items: center; gap: .35rem; }
      .swatch { width: .85rem; height: .85rem; border: 2px solid #141a26; background: #b9c7da; }
      .swatch.movable { box-shadow: inset 0 0 0 2px #f59272; background: #3a4a68; }
      .variant-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
      .variant-samples { display: flex; align-items: end; gap: 1rem; margin-top: .65rem; }
      .variant-samples figure { display: grid; justify-items: center; gap: .3rem; margin: 0; color: var(--muted); font-size: .68rem; }
      .variant-samples img { width: 32px; height: 32px; image-rendering: pixelated; }
      .variant-samples img.double { width: 64px; height: 64px; }
      .source-row { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
      .source-row img { width: 64px; height: 64px; image-rendering: pixelated; background: repeating-conic-gradient(#202d42 0 25%, #172131 0 50%) 50% / .75rem .75rem; }
      code { color: #dce6f6; }
      @media (max-width: 720px) { .map-grid { grid-template-columns: 1fr; } .variant-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 390px) { body { padding: 1rem .75rem; } .variant-grid { grid-template-columns: 1fr 1fr; gap: .5rem; } .variant-card { padding: .6rem; } .variant-samples { gap: .5rem; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>TUX-01 · MICRO MOSAIC REVIEW</h1>
          <p>24×32 target sockets with a deterministic opening permutation. Transparent Micro geometry is kept under review until the art is approved for promotion.</p>
        </div>
        <div class="proof"><strong>${map.stats.active} active</strong><span>·</span><strong>${(map.stats.matchedRatio * 100).toFixed(2)}% locked</strong><span>·</span><strong>${map.stats.mismatches} movable</strong><span>·</span><strong>shelf 16</strong></div>
      </header>
      <section aria-labelledby="maps-title">
        <h2 id="maps-title">Target and opening state</h2>
        <div class="map-grid">
          <figure class="map-card">
            <div class="map-stage"><img src="target-map.png" alt="Target Tux mosaic with final socket colors" /></div>
            <figcaption><b>Target sockets</b> · the final Tux silhouette. Every active coordinate is a real color-matching destination; voids remain transparent.</figcaption>
          </figure>
          <figure class="map-card">
            <div class="map-stage"><img src="opening-map.png" alt="Opening Tux mosaic with locked and movable gems" /></div>
            <figcaption><b>Opening permutation</b> · matching gems are locked flush; inset gems with a coral edge are mismatched and movable.</figcaption>
          </figure>
        </div>
        <div class="legend" aria-label="Locked and movable legend">
          <span class="legend-item"><i class="swatch" aria-hidden="true"></i> locked / matched</span>
          <span class="legend-item"><i class="swatch movable" aria-hidden="true"></i> movable / mismatched</span>
          <span class="legend-item">transparent void · no socket</span>
        </div>
        <div class="proof" aria-label="Target color counts">${counts}</div>
      </section>
      <section aria-labelledby="variants-title">
        <h2 id="variants-title">Micro socket / gem variants · one and two times scale</h2>
        <div class="variant-grid">${variants}
        </div>
      </section>
      <section aria-labelledby="source-title">
        <h2 id="source-title">Validated master geometry</h2>
        <figure class="source-card">
          <div class="source-row"><img src="../../inbox/tux-mosaic/micro-master.png" alt="32 by 32 transparent Micro master geometry" /><figcaption><b>micro-master.png</b> · 32×32, binary Alpha, finite semantic source palette. Derived variants preserve this Alpha mask.</figcaption></div>
        </figure>
      </section>
    </main>
  </body>
</html>
`;
}

const map = JSON.parse(await Bun.file(mapPath).text()) as TuxMap;
const manifest = JSON.parse(await Bun.file(palettePath).text()) as PaletteManifest;
const variantNames = ["obsidian", "pearl", "amber", "navy", "ice", "coral"] as const;
const resolvedVariants = Object.fromEntries(variantNames.map((name) => [name, resolvedVariant(manifest, name)])) as Record<string, ResolvedVariant>;

await mkdir(dirname(masterPath), { recursive: true });
await mkdir(reviewDirectory, { recursive: true });
await writePng(masterPath, buildMicroMaster(manifest));
await writePng(resolve(reviewDirectory, "target-map.png"), buildMapPreview(map, false));
await writePng(resolve(reviewDirectory, "opening-map.png"), buildMapPreview(map, true));
await Bun.write(resolve(reviewDirectory, "index.html"), buildReviewHtml(map, variantNames));
console.log(JSON.stringify({ master: masterPath, review: reviewDirectory, variants: variantNames }, null, 2));
