import { resolve } from "node:path";

type TuxMap = {
  readonly id: string;
  readonly version: number;
  readonly width: number;
  readonly height: number;
  readonly shelfCapacity: number;
  readonly palette: Record<string, string>;
  readonly targets: readonly string[];
  readonly gems: readonly string[];
  readonly stats?: {
    readonly active: number;
    readonly matches: number;
    readonly mismatches: number;
    readonly matchedRatio: number;
    readonly targetColorCounts: Record<string, number>;
  };
};

const mapPath = resolve(process.cwd(), process.argv[2] ?? "art/inbox/tux-mosaic/tux-01.map.json");
const map = JSON.parse(await Bun.file(mapPath).text()) as TuxMap;
const fail = (message: string): never => { throw new Error(message); };
const requiredColors = ["obsidian", "pearl", "amber", "navy", "ice", "coral"] as const;

if (map.version !== 1) fail(`version must equal 1 (got ${map.version})`);
if (map.width !== 24 || map.height !== 32) fail(`dimensions must be exactly 24×32 (got ${map.width}×${map.height})`);
if (map.shelfCapacity !== 16) fail(`Shelf capacity must equal 16 (got ${map.shelfCapacity})`);
if (map.targets.length !== map.height || map.gems.length !== map.height) fail("target and gem row counts must equal height");
if (Object.keys(map.palette).length !== requiredColors.length || requiredColors.some((color) => !Object.values(map.palette).includes(color))) {
  fail(`palette must contain exactly ${requiredColors.join(", ")}`);
}

const symbols = new Set(Object.keys(map.palette));
const targetCounts: Record<string, number> = {};
const gemCounts: Record<string, number> = {};
let active = 0;
let matches = 0;

for (let row = 0; row < map.height; row += 1) {
  const targetRow = map.targets[row]!;
  const gemRow = map.gems[row]!;
  if (targetRow.length !== map.width || gemRow.length !== map.width) fail(`row ${row} must contain exactly ${map.width} columns`);

  for (let column = 0; column < map.width; column += 1) {
    const target = targetRow[column]!;
    const gem = gemRow[column]!;
    if (target === "." || gem === ".") {
      if (target !== gem) fail(`active-mask mismatch at row ${row}, column ${column}`);
      continue;
    }
    if (!symbols.has(target) || !symbols.has(gem)) fail(`unknown symbol at row ${row}, column ${column}`);
    active += 1;
    targetCounts[target] = (targetCounts[target] ?? 0) + 1;
    gemCounts[gem] = (gemCounts[gem] ?? 0) + 1;
    if (target === gem) matches += 1;
  }
}

if (active < 450 || active > 550) fail(`active count must be 450–550 (got ${active})`);
const ratio = matches / active;
if (ratio < 0.7 || ratio > 0.8) fail(`matched ratio must be 70%–80% (got ${(ratio * 100).toFixed(2)}%)`);
for (const symbol of symbols) {
  if ((targetCounts[symbol] ?? 0) !== (gemCounts[symbol] ?? 0)) {
    fail(`color conservation failed for ${map.palette[symbol]}: target=${targetCounts[symbol] ?? 0}, gem=${gemCounts[symbol] ?? 0}`);
  }
}

if (map.stats) {
  if (map.stats.active !== active || map.stats.matches !== matches || map.stats.mismatches !== active - matches) fail("stored map statistics are stale");
  if (Math.abs(map.stats.matchedRatio - ratio) > Number.EPSILON) fail("stored matched ratio is stale");
  for (const symbol of symbols) if (map.stats.targetColorCounts[symbol] !== targetCounts[symbol]) fail(`stored count is stale for ${map.palette[symbol]}`);
}

console.log(JSON.stringify({
  file: mapPath,
  dimensions: `${map.width}×${map.height}`,
  active,
  matches,
  mismatches: active - matches,
  matchedRatio: ratio,
  shelfCapacity: map.shelfCapacity,
  targetColorCounts: Object.fromEntries([...symbols].map((symbol) => [map.palette[symbol], targetCounts[symbol] ?? 0])),
}, null, 2));
