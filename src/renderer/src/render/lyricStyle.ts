/**
 * How the lyrics layer draws a 장: the lyric style fields of a Look
 * (docs/spec/02-data.md). Sizes are px on a 1920 x 1080 screen.
 */
export interface LyricStyle {
  readonly font: string;
  readonly weight: number;
  readonly size: number;
  readonly color: string;
  readonly lineHeight: number;
  readonly align: 'left' | 'center';
  readonly vAlign: 'top' | 'middle' | 'bottom';
  /** The 장 shrinks until its text fits the height of this many lines. */
  readonly maxLines: number;
  /** The margin on every side, in percent of the screen. */
  readonly margin: number;
  readonly shadow: boolean;
  readonly outline: boolean;
}

// TODO(0913vision): Take the lyric style from the current Look once the
// settings store sends it.
/** 기본 (default), with the values of the `Looks` board. */
export const DEFAULT_LYRIC_STYLE: LyricStyle = {
  font: 'Pretendard',
  weight: 700,
  size: 84,
  color: '#FFFFFF',
  lineHeight: 1.4,
  align: 'center',
  vAlign: 'middle',
  maxLines: 2,
  margin: 6,
  shadow: true,
  outline: false,
};

/** The screen size that lyric style sizes are written for. */
export const REFERENCE_SCREEN = {width: 1920, height: 1080} as const;

/** The factor that turns reference px into px on a screen of this size. */
export function scaleFor(width: number, height: number): number {
  return Math.min(
    width / REFERENCE_SCREEN.width,
    height / REFERENCE_SCREEN.height,
  );
}
