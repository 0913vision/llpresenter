import {
  DEFAULT_MESSAGE_STYLE,
  MESSAGE_BAND_BACKGROUND,
  type MessageStyle,
} from '../schema/messages';

/**
 * The style a screen draws its 메시지 in. A missing or unknown id means the
 * built-in 기본 style.
 */
export function resolveMessageStyle(
  styles: readonly MessageStyle[] | undefined,
  id: string | undefined,
): MessageStyle {
  if (id === undefined) return DEFAULT_MESSAGE_STYLE;
  return styles?.find(style => style.id === id) ?? DEFAULT_MESSAGE_STYLE;
}

/**
 * How the built-in 기본 메시지 style draws: a full-width band at the top edge.
 * Sizes are px on a 1920 x 1080 screen and scale with it like every other
 * output element. The text size is 5% of the height, the padding 1.6% of the
 * height above and below and 4% of the width at the sides.
 */
export const MESSAGE_BAND: MessageBand = {
  font: DEFAULT_MESSAGE_STYLE.font,
  size: DEFAULT_MESSAGE_STYLE.size,
  weight: DEFAULT_MESSAGE_STYLE.weight,
  color: DEFAULT_MESSAGE_STYLE.color,
  lineHeight: DEFAULT_MESSAGE_STYLE.lineHeight,
  maxLines: DEFAULT_MESSAGE_STYLE.maxLines,
  paddingY: 17.28,
  paddingX: 76.8,
  background: MESSAGE_BAND_BACKGROUND,
};

export interface MessageBand {
  readonly font: string;
  readonly size: number;
  readonly weight: number;
  readonly color: string;
  readonly lineHeight: number;
  readonly maxLines: number;
  readonly paddingY: number;
  readonly paddingX: number;
  readonly background: {readonly color: string; readonly opacity: number};
}

/**
 * The band for a resolved style: only the built-in 기본 style is a band. Over
 * the chroma key green the band is opaque black, so a keyer leaves a clean band
 * instead of a half-keyed dark green box.
 * NOTE(0913vision): The built-in style is told apart by object identity; a
 * copy of it, such as one that went through a clone, is not a band. The
 * screen frames always pass the same object, and a saved style is never a band.
 */
export function messageBandFor(
  style: MessageStyle,
  overChroma = false,
): MessageBand | undefined {
  if (style !== DEFAULT_MESSAGE_STYLE) return undefined;
  return overChroma
    ? {...MESSAGE_BAND, background: {...MESSAGE_BAND.background, opacity: 100}}
    : MESSAGE_BAND;
}
