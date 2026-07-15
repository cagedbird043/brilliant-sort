import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { encodePng, readPng } from "./png";
import type { DecodedPng } from "./png";
import type { DerivedSprite, PaletteManifest, PaletteRole, Rgb, SpriteInspection } from "./types";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const ROLE_NAME = /^[a-z][A-Za-z0-9]*$/;
const VARIANT_NAME = /^[a-z][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


function normalizeHex(value: unknown, context: string): string {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new Error(`${context} must be a #RRGGBB color`);
  }

  return value.toUpperCase();
}

function assertRoleName(roleName: string): void {
  if (!ROLE_NAME.test(roleName)) {
    throw new Error(`Palette role name must be lower-camel-case: ${roleName}`);
  }
}

function assertVariantName(variantName: string): void {
  if (!VARIANT_NAME.test(variantName)) {
    throw new Error(`Variant name must use lowercase letters, digits, or hyphens: ${variantName}`);
  }
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex, "Color");
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

export function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function rgbKey(red: number, green: number, blue: number): string {
  return `${red},${green},${blue}`;
}

export function parsePaletteManifest(value: unknown): PaletteManifest {
  if (!isRecord(value)) {
    throw new Error("Palette manifest must be a JSON object");
  }
  if (value.version !== 1) {
    throw new Error("Palette manifest version must equal 1");
  }
  if (!isRecord(value.roles) || Object.keys(value.roles).length === 0) {
    throw new Error("Palette manifest must declare at least one role");
  }
  if (!isRecord(value.variants) || Object.keys(value.variants).length === 0) {
    throw new Error("Palette manifest must declare at least one variant");
  }

  const roles: Record<string, PaletteRole> = {};
  const roleBySourceColor = new Map<string, string>();

  for (const [roleName, rawRole] of Object.entries(value.roles)) {
    assertRoleName(roleName);
    if (!isRecord(rawRole)) {
      throw new Error(`Palette role ${roleName} must be an object`);
    }

    const source = normalizeHex(rawRole.source, `Palette role ${roleName}.source`);
    if (rawRole.fixed !== undefined && typeof rawRole.fixed !== "boolean") {
      throw new Error(`Palette role ${roleName}.fixed must be boolean when present`);
    }

    const [red, green, blue] = hexToRgb(source);
    const key = rgbKey(red, green, blue);
    const existingRole = roleBySourceColor.get(key);
    if (existingRole) {
      throw new Error(`Palette roles ${existingRole} and ${roleName} share source color ${source}`);
    }

    roleBySourceColor.set(key, roleName);
    roles[roleName] = rawRole.fixed === true ? { source, fixed: true } : { source };
  }

  const variants: Record<string, Record<string, string>> = {};
  for (const [variantName, rawVariant] of Object.entries(value.variants)) {
    assertVariantName(variantName);
    if (!isRecord(rawVariant)) {
      throw new Error(`Palette variant ${variantName} must be an object`);
    }

    const variant: Record<string, string> = {};
    for (const [roleName, rawColor] of Object.entries(rawVariant)) {
      const role = roles[roleName];
      if (!role) {
        throw new Error(`Palette variant ${variantName} references unknown role ${roleName}`);
      }
      if (role.fixed) {
        throw new Error(`Palette variant ${variantName} may not override fixed role ${roleName}`);
      }
      variant[roleName] = normalizeHex(rawColor, `Palette variant ${variantName}.${roleName}`);
    }

    for (const [roleName, role] of Object.entries(roles)) {
      if (!role.fixed && !Object.prototype.hasOwnProperty.call(variant, roleName)) {
        throw new Error(`Palette variant ${variantName} is missing non-fixed role ${roleName}`);
      }
    }

    variants[variantName] = variant;
  }

  return {
    version: 1,
    roles,
    variants,
  };
}

export async function readPaletteManifest(filePath: string): Promise<PaletteManifest> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`Palette manifest does not exist: ${filePath}`);
  }

  try {
    return parsePaletteManifest(JSON.parse(await file.text()) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read palette manifest ${filePath}: ${message}`);
  }
}

export function inspectDecodedPng(filePath: string, image: DecodedPng): SpriteInspection {
  let transparentPixels = 0;
  let translucentPixels = 0;
  let opaquePixels = 0;
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  const opaquePalette = new Set<string>();

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const alpha = image.data[offset + 3];
    const pixelIndex = offset / 4;
    const x = pixelIndex % image.width;
    const y = Math.floor(pixelIndex / image.width);

    if (alpha === 0) {
      transparentPixels += 1;
      continue;
    }
    if (alpha !== 255) {
      translucentPixels += 1;
      continue;
    }

    opaquePixels += 1;
    opaquePalette.add(rgbToHex(red, green, blue));
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }

  return {
    file: filePath,
    width: image.width,
    height: image.height,
    alpha: { transparentPixels, translucentPixels, opaquePixels },
    opaqueBounds:
      opaquePixels === 0
        ? null
        : { left, top, width: right - left + 1, height: bottom - top + 1 },
    opaquePalette: [...opaquePalette].sort(),
  };
}

export async function inspectPng(filePath: string): Promise<SpriteInspection> {
  return inspectDecodedPng(filePath, await readPng(filePath));
}

function deriveDecodedPngs(image: DecodedPng, manifest: PaletteManifest): ReadonlyMap<string, DecodedPng> {
  const roleBySourceColor = new Map<string, string>();
  const targetRgbByVariant = new Map<string, ReadonlyMap<string, Rgb>>();

  for (const [roleName, role] of Object.entries(manifest.roles)) {
    const [red, green, blue] = hexToRgb(role.source);
    roleBySourceColor.set(rgbKey(red, green, blue), roleName);
  }

  for (const [variantName, variant] of Object.entries(manifest.variants)) {
    const targetRgbByRole = new Map<string, Rgb>();
    for (const [roleName, role] of Object.entries(manifest.roles)) {
      targetRgbByRole.set(roleName, hexToRgb(role.fixed ? role.source : variant[roleName]!));
    }
    targetRgbByVariant.set(variantName, targetRgbByRole);
  }

  const outputs = new Map<string, DecodedPng>();
  for (const variantName of Object.keys(manifest.variants)) {
    outputs.set(variantName, {
      width: image.width,
      height: image.height,
      data: Buffer.from(image.data),
    });
  }

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const alpha = image.data[offset + 3];
    const pixelIndex = offset / 4;
    const x = pixelIndex % image.width;
    const y = Math.floor(pixelIndex / image.width);

    if (alpha === 0) {
      continue;
    }
    if (alpha !== 255) {
      throw new Error(`Source requires binary Alpha; found ${alpha} at (${x}, ${y})`);
    }

    const roleName = roleBySourceColor.get(rgbKey(red, green, blue));
    if (!roleName) {
      throw new Error(`Source pixel ${rgbToHex(red, green, blue)} at (${x}, ${y}) is absent from the palette manifest`);
    }

    for (const [variantName, output] of outputs) {
      const target = targetRgbByVariant.get(variantName)?.get(roleName);
      if (!target) {
        throw new Error(`Palette variant ${variantName} has no resolved color for role ${roleName}`);
      }
      output.data[offset] = target[0];
      output.data[offset + 1] = target[1];
      output.data[offset + 2] = target[2];
    }
  }

  return outputs;
}

export async function derivePngVariants(
  sourcePath: string,
  palettePath: string,
  outputDirectory: string,
): Promise<readonly DerivedSprite[]> {
  const [source, manifest] = await Promise.all([readPng(sourcePath), readPaletteManifest(palettePath)]);
  const outputs = deriveDecodedPngs(source, manifest);

  await mkdir(outputDirectory, { recursive: true });
  const written: DerivedSprite[] = [];
  for (const [variantName, output] of outputs) {
    const outputPath = join(outputDirectory, `${variantName}.png`);
    await Bun.write(outputPath, encodePng(output));
    written.push({ variant: variantName, path: outputPath });
  }

  return written;
}

export function deriveInMemory(image: DecodedPng, manifest: PaletteManifest): ReadonlyMap<string, DecodedPng> {
  return deriveDecodedPngs(image, manifest);
}
