import { derivePngVariants, inspectPng } from "./core";
import { createSpritePreview } from "./preview";

function usage(): string {
  return [
    "Usage:",
    "  bun run pixel-bloom inspect <source.png> [--json]",
    "  bun run pixel-bloom derive --source <source.png> --palette <palette.json> --out <directory>",
    "  bun run pixel-bloom preview --sprites <directory> --out <preview.html>",
  ].join("\n");
}

function parseNamedOptions(args: readonly string[], expected: readonly string[]): Readonly<Record<string, string>> {
  const options: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(usage());
    }

    const name = flag.slice(2);
    if (!expected.includes(name) || options[name] !== undefined) {
      throw new Error(usage());
    }
    options[name] = value;
  }

  for (const name of expected) {
    if (options[name] === undefined) {
      throw new Error(usage());
    }
  }

  return options;
}

export async function runPixelBloom(args: readonly string[]): Promise<void> {
  const [operation, ...rest] = args;

  switch (operation) {
    case "inspect": {
      const [sourcePath, ...flags] = rest;
      if (!sourcePath || sourcePath.startsWith("--") || flags.some((flag) => flag !== "--json")) {
        throw new Error(usage());
      }

      const inspection = await inspectPng(sourcePath);
      if (flags.includes("--json")) {
        console.log(JSON.stringify(inspection, null, 2));
        return;
      }

      console.log(
        [
          `file: ${inspection.file}`,
          `dimensions: ${inspection.width}×${inspection.height}`,
          `alpha: transparent=${inspection.alpha.transparentPixels}, translucent=${inspection.alpha.translucentPixels}, opaque=${inspection.alpha.opaquePixels}`,
          `opaque bounds: ${inspection.opaqueBounds ? `${inspection.opaqueBounds.left},${inspection.opaqueBounds.top} ${inspection.opaqueBounds.width}×${inspection.opaqueBounds.height}` : "none"}`,
          `opaque palette (${inspection.opaquePalette.length}): ${inspection.opaquePalette.join(", ")}`,
        ].join("\n"),
      );
      return;
    }
    case "derive": {
      const options = parseNamedOptions(rest, ["source", "palette", "out"]);
      const variants = await derivePngVariants(options.source, options.palette, options.out);
      console.log(JSON.stringify({ source: options.source, palette: options.palette, out: options.out, variants }, null, 2));
      return;
    }
    case "preview": {
      const options = parseNamedOptions(rest, ["sprites", "out"]);
      const sprites = await createSpritePreview(options.sprites, options.out);
      console.log(JSON.stringify({ sprites: options.sprites, out: options.out, files: sprites }, null, 2));
      return;
    }
    default:
      throw new Error(usage());
  }
}

if (import.meta.main) {
  try {
    await runPixelBloom(Bun.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`pixel-bloom: ${message}`);
    process.exitCode = 1;
  }
}
