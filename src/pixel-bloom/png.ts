import { PNG } from "pngjs";

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

export async function readPng(filePath: string): Promise<DecodedPng> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`PNG file does not exist: ${filePath}`);
  }

  try {
    const image = PNG.sync.read(Buffer.from(await file.arrayBuffer()));
    return {
      width: image.width,
      height: image.height,
      data: Buffer.from(image.data),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot decode PNG ${filePath}: ${message}`);
  }
}

export function encodePng(image: DecodedPng): Buffer {
  const png = new PNG({
    width: image.width,
    height: image.height,
    colorType: 6,
    inputHasAlpha: true,
  });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png, {
    colorType: 6,
    inputHasAlpha: true,
  });
}
