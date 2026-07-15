export type Rgb = readonly [red: number, green: number, blue: number];

export interface PaletteRole {
  readonly source: string;
  readonly fixed?: boolean;
}

export interface PaletteManifest {
  readonly version: 1;
  readonly roles: Readonly<Record<string, PaletteRole>>;
  readonly variants: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface AlphaStatistics {
  readonly transparentPixels: number;
  readonly translucentPixels: number;
  readonly opaquePixels: number;
}

export interface OpaqueBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SpriteInspection {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly alpha: AlphaStatistics;
  readonly opaqueBounds: OpaqueBounds | null;
  readonly opaquePalette: readonly string[];
}

export interface DerivedSprite {
  readonly variant: string;
  readonly path: string;
}

export interface PreviewSprite {
  readonly fileName: string;
  readonly relativePath: string;
  readonly width: number;
  readonly height: number;
}
