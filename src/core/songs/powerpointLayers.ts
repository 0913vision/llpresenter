export const POWERPOINT_BACKGROUND_LIMITS = {
  layers: 64,
  stops: 256,
  imageBytes: 32 * 1024 * 1024,
  totalImageBytes: 128 * 1024 * 1024,
  imagePixels: 64 * 1024 * 1024,
  imageSide: 16384,
  width: 1920,
  height: 1080,
} as const;

export interface PowerPointColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}
export interface PowerPointInsets {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
/** Maps a layer's unit rectangle into the reference picture, including groups. */
export interface PowerPointMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}
export type PowerPointFill =
  | {readonly kind: 'solid'; readonly color: PowerPointColor}
  | {
      readonly kind: 'gradient';
      readonly angle: number;
      readonly scaled: boolean;
      readonly radial: boolean;
      readonly focus: PowerPointInsets;
      readonly stops: ReadonlyArray<{
        readonly position: number;
        readonly color: PowerPointColor;
      }>;
    };
export type PowerPointLayer =
  | {
      readonly kind: 'picture';
      readonly id: string;
      readonly matrix: PowerPointMatrix;
      readonly part: string;
      readonly crop: PowerPointInsets;
      readonly stretch: PowerPointInsets;
      readonly alpha: number;
      readonly brightness: number;
      readonly contrast: number;
      readonly grayscale: boolean;
    }
  | {
      readonly kind: 'shape';
      readonly id: string;
      readonly matrix: PowerPointMatrix;
      readonly geometry: 'rect' | 'roundRect' | 'ellipse';
      readonly radius: number;
      readonly fill: PowerPointFill | null;
      readonly outline: {
        readonly width: number;
        readonly fill: PowerPointFill;
      } | null;
    };
export interface PowerPointLayers {
  readonly key: string;
  readonly layers: readonly PowerPointLayer[];
  readonly skipped: number;
}
export interface PowerPointPicturePart {
  readonly part: string;
  readonly mime: 'image/jpeg' | 'image/png';
  readonly bytes: Uint8Array;
}
export interface PowerPointScene extends PowerPointLayers {
  readonly pictures: readonly PowerPointPicturePart[];
}
