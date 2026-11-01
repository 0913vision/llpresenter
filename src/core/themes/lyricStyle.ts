import type {LyricOutline, LyricShadow} from '../schema/lyricEffects';

/**
 * How a text layer draws its text: the lyrics of a 장, a 테마 text element, a
 * 메시지, or 소품 text. Sizes are px on a 1920 x 1080 screen.
 */
export interface LyricStyle {
  readonly font: string;
  readonly weight: number;
  readonly size: number;
  readonly color: string;
  readonly lineHeight: number;
  readonly align: 'left' | 'center' | 'right';
  readonly vAlign: 'top' | 'middle' | 'bottom';
  /** The 장 shrinks until its text fits the height of this many lines. */
  readonly maxLines: number;
  /** The margin on every side, in percent of the screen. */
  readonly margin: number;
  readonly shadow: boolean | LyricShadow;
  readonly outline: boolean | LyricOutline;
}

/** The style of text that has no 테마 element to style it. */
export const DEFAULT_LYRIC_STYLE = {
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
} as const satisfies LyricStyle;

/** The screen size that text sizes are written for. */
export const REFERENCE_SCREEN = {width: 1920, height: 1080} as const;

/** Fixed switch values from spec 03 and 10, in reference-screen pixels. */
export const LYRIC_EFFECTS = {
  outlineWidth: 3,
  shadowDistance: 4,
  shadowBlur: 8,
  shadowOpacity: 0.6,
} as const;

/** The factor that turns reference px into px on a screen of this size. */
export function scaleFor(width: number, height: number): number {
  return Math.min(
    width / REFERENCE_SCREEN.width,
    height / REFERENCE_SCREEN.height,
  );
}
