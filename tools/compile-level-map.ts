import { COLORS, type Color, type LevelSpec } from "../src/core/types";

interface MapConstraints {
  readonly minActive: number;
  readonly maxActive: number;
  readonly minMatchedRatio: number;
  readonly maxMatchedRatio: number;
}

export interface LevelMapSource {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly rows: number;
  readonly cols: number;
  readonly shelfCapacity: number;
  readonly palette: Readonly<Record<string, Color>>;
  readonly targets: readonly string[];
  readonly gems: readonly string[];
  readonly constraints: MapConstraints;
}

function fail(message: string): never {
  throw new Error(`Invalid level map: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isInteger(value)) {
    fail(`${key} must be an integer`);
  }
  return value as number;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${key} must be a finite number`);
  }
  return value;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    fail(`${key} must be a non-empty string`);
  }
  return value;
}

function requireRows(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((row) => typeof row !== "string")) {
    fail(`${key} must be an array of strings`);
  }
  return value as readonly string[];
}

function parsePalette(value: unknown): Readonly<Record<string, Color>> {
  if (!isRecord(value)) {
    fail("palette must be an object");
  }

  const palette: Record<string, Color> = {};
  for (const [symbol, color] of Object.entries(value)) {
    if (symbol === "." || [...symbol].length !== 1) {
      fail(`palette symbol ${JSON.stringify(symbol)} must be one character other than '.'`);
    }
    if (typeof color !== "string" || !COLORS.includes(color as Color)) {
      fail(`palette symbol ${symbol} uses unsupported color ${JSON.stringify(color)}`);
    }
    palette[symbol] = color as Color;
  }

  if (Object.keys(palette).length === 0) {
    fail("palette must declare at least one color symbol");
  }
  return palette;
}

function parseSource(value: unknown): LevelMapSource {
  if (!isRecord(value)) {
    fail("source root must be an object");
  }
  if (requireInteger(value, "schemaVersion") !== 1) {
    fail("schemaVersion must be 1");
  }

  const rows = requireInteger(value, "rows");
  const cols = requireInteger(value, "cols");
  const shelfCapacity = requireInteger(value, "shelfCapacity");
  if (rows <= 0 || cols <= 0 || shelfCapacity <= 0) {
    fail("rows, cols, and shelfCapacity must be positive");
  }

  if (!isRecord(value.constraints)) {
    fail("constraints must be an object");
  }
  const constraints: MapConstraints = {
    minActive: requireInteger(value.constraints, "minActive"),
    maxActive: requireInteger(value.constraints, "maxActive"),
    minMatchedRatio: requireNumber(value.constraints, "minMatchedRatio"),
    maxMatchedRatio: requireNumber(value.constraints, "maxMatchedRatio"),
  };
  if (
    constraints.minActive < 1 ||
    constraints.maxActive < constraints.minActive ||
    constraints.minMatchedRatio < 0 ||
    constraints.maxMatchedRatio > 1 ||
    constraints.maxMatchedRatio < constraints.minMatchedRatio
  ) {
    fail("constraints contain an invalid active-count or matched-ratio range");
  }

  return {
    schemaVersion: 1,
    id: requireString(value, "id"),
    rows,
    cols,
    shelfCapacity,
    palette: parsePalette(value.palette),
    targets: requireRows(value, "targets"),
    gems: requireRows(value, "gems"),
    constraints,
  };
}


export function compileLevelMap(value: unknown): LevelSpec {
  const source = parseSource(value);
  if (source.targets.length !== source.rows || source.gems.length !== source.rows) {
    fail(`targets and gems must each contain exactly ${source.rows} rows`);
  }

  const cells: Array<LevelSpec["cells"][number]> = [];
  const targetCounts: Record<Color, number> = {
    navy: 0,
    ice: 0,
    coral: 0,
    jade: 0,
    obsidian: 0,
    pearl: 0,
    amber: 0,
  };
  const gemCounts: Record<Color, number> = {
    navy: 0,
    ice: 0,
    coral: 0,
    jade: 0,
    obsidian: 0,
    pearl: 0,
    amber: 0,
  };
  let matched = 0;

  for (let row = 0; row < source.rows; row += 1) {
    const targetRow = source.targets[row]!;
    const gemRow = source.gems[row]!;
    if ([...targetRow].length !== source.cols || [...gemRow].length !== source.cols) {
      fail(`row ${row} must contain exactly ${source.cols} columns in both maps`);
    }

    for (let col = 0; col < source.cols; col += 1) {
      const targetSymbol = targetRow[col]!;
      const gemSymbol = gemRow[col]!;
      if ((targetSymbol === ".") !== (gemSymbol === ".")) {
        fail(`target/gem masks differ at ${row}:${col}`);
      }
      if (targetSymbol === ".") {
        continue;
      }

      const targetColor = source.palette[targetSymbol];
      const gemColor = source.palette[gemSymbol];
      if (targetColor === undefined) {
        fail(`unknown target symbol ${JSON.stringify(targetSymbol)} at ${row}:${col}`);
      }
      if (gemColor === undefined) {
        fail(`unknown gem symbol ${JSON.stringify(gemSymbol)} at ${row}:${col}`);
      }

      targetCounts[targetColor] += 1;
      gemCounts[gemColor] += 1;
      if (targetColor === gemColor) {
        matched += 1;
      }
      cells.push({
        row,
        col,
        targetColor,
        gem: {
          id: `${source.id}-r${String(row).padStart(2, "0")}-c${String(col).padStart(2, "0")}`,
          color: gemColor,
        },
      });
    }
  }

  if (cells.length < source.constraints.minActive || cells.length > source.constraints.maxActive) {
    fail(
      `active cell count ${cells.length} is outside ${source.constraints.minActive}..${source.constraints.maxActive}`,
    );
  }
  const matchedRatio = matched / cells.length;
  if (
    matchedRatio < source.constraints.minMatchedRatio ||
    matchedRatio > source.constraints.maxMatchedRatio
  ) {
    fail(
      `matched ratio ${matchedRatio.toFixed(6)} is outside ${source.constraints.minMatchedRatio}..${source.constraints.maxMatchedRatio}`,
    );
  }

  for (const color of COLORS) {
    const targetCount = targetCounts[color];
    const gemCount = gemCounts[color];
    if (targetCount !== gemCount) {
      fail(`color conservation failed for ${color}: targets=${targetCount}, gems=${gemCount}`);
    }
  }

  return {
    schemaVersion: 1,
    id: source.id,
    rows: source.rows,
    cols: source.cols,
    shelfCapacity: source.shelfCapacity,
    cells,
  };
}

export function serializeLevelSpec(spec: LevelSpec): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}

async function main(): Promise<void> {
  const [sourcePath, outputPath, mode] = Bun.argv.slice(2);
  if (sourcePath === undefined || outputPath === undefined || (mode !== undefined && mode !== "--check")) {
    throw new Error("Usage: bun tools/compile-level-map.ts <source.json> <output.json> [--check]");
  }

  const source = await Bun.file(sourcePath).json();
  const output = serializeLevelSpec(compileLevelMap(source));
  if (mode === "--check") {
    if (!(await Bun.file(outputPath).exists()) || (await Bun.file(outputPath).text()) !== output) {
      throw new Error(`Generated level is stale: ${outputPath}`);
    }
    return;
  }
  await Bun.write(outputPath, output);
}

if (import.meta.main) {
  await main();
}
