import { mkdir, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { readPng } from "./png";
import type { PreviewSprite } from "./types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "'":
        return "&#39;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}

export async function createSpritePreview(spriteDirectory: string, outputPath: string): Promise<readonly PreviewSprite[]> {
  const entries = await readdir(spriteDirectory, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".png")
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (fileNames.length === 0) {
    throw new Error(`No PNG sprites found in ${spriteDirectory}`);
  }

  const outputDirectory = dirname(outputPath);
  const sprites = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = join(spriteDirectory, fileName);
      const image = await readPng(filePath);
      return {
        fileName,
        relativePath: relative(outputDirectory, filePath)
          .split(sep)
          .map((segment) => encodeURIComponent(segment))
          .join("/"),
        width: image.width,
        height: image.height,
      } satisfies PreviewSprite;
    }),
  );

  const cards = sprites
    .map(
      (sprite) => `
        <figure class="sprite-card">
          <div class="sprite-stage"><img src="${escapeHtml(sprite.relativePath)}" alt="${escapeHtml(sprite.fileName)}" /></div>
          <figcaption>${escapeHtml(sprite.fileName)} · ${sprite.width}×${sprite.height}</figcaption>
        </figure>`,
    )
    .join("\n");

  await mkdir(outputDirectory, { recursive: true });
  await Bun.write(
    outputPath,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>pixel-bloom sprite review</title>
    <style>
      :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; background: #0b1020; color: #e8f0ff; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; padding: clamp(1rem, 5vw, 3rem); background: radial-gradient(circle at 50% 0%, #1f3659, transparent 44rem), #0b1020; }
      main { width: min(100%, 56rem); margin: 0 auto; padding: clamp(1rem, 4vw, 2rem); border: 2px solid #2d4169; border-radius: 1rem; background: #111b31; box-shadow: 0 1.25rem 0 #050b16, 0 2rem 4rem #0008; }
      h1 { margin: 0; font-size: clamp(1rem, 3vw, 1.25rem); letter-spacing: .08em; }
      p { margin: .75rem 0 1.5rem; color: #9db1d7; line-height: 1.6; font-size: .8125rem; }
      .sprite-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: .75rem; padding: .875rem; border: 3px solid #29416b; border-radius: .875rem; background: #172440; }
      .sprite-card { min-width: 0; margin: 0; padding: .75rem; border: 2px solid #071227; border-radius: .625rem; background: linear-gradient(135deg, #2c3e65 0 50%, #1a2949 50%); box-shadow: inset 0 0 0 2px #506b99, inset 0 .5rem 0 #ffffff0d; }
      .sprite-stage { min-height: 5rem; display: grid; place-items: center; }
      img { width: 4rem; height: 4rem; object-fit: contain; image-rendering: pixelated; filter: drop-shadow(0 .375rem 0 #020817cc); }
      figcaption { overflow-wrap: anywhere; color: #cbd9f2; font-size: .6875rem; line-height: 1.5; text-align: center; }
      @media (max-width: 390px) { body { padding: 1rem; } .sprite-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; padding: .625rem; } .sprite-card { padding: .5rem; } }
    </style>
  </head>
  <body>
    <main>
      <h1>pixel-bloom · sprite review</h1>
      <p>Local preview generated from validated PNG assets. Geometry and Alpha should be reviewed before game integration.</p>
      <section class="sprite-grid" aria-label="Generated sprite preview">${cards}
      </section>
    </main>
  </body>
</html>
`,
  );

  return sprites;
}
