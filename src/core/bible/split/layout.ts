/** The mark added to a slide whose verse goes on to the next slide. */
export const CONT_MARKER = ' (계속)';
/** The font sizes PowerPoint's size list offers, in points. */
export const POWERPOINT_SIZES = [
  8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60,
  66, 72, 80, 88, 96,
] as const;

/**
 * The text box a verse is fitted into: font, size, tracking, width and line
 * limit.
 */
export interface SplitSpec {
  readonly font: string;
  readonly size: number;
  readonly tracking: number;
  readonly width: number;
  readonly maxLines: number;
  readonly markerTracking: number;
}

/** Wrapped lines with their widths, and whether they fit the line limit. */
export interface LayoutResult {
  readonly lines: readonly string[];
  readonly lineWidths: readonly number[];
  readonly maxWidth: number;
  readonly nLines: number;
  readonly fits: boolean;
}

/** Measures wrapped text and its optional smaller marker in the same units as spec. */
export type Measure = (
  text: string,
  options: SplitSpec & {readonly marker: string; readonly markerSize: number},
) => LayoutResult;

/** A text box with the function that measures text in it. */
export interface SplitLayout {
  readonly spec: SplitSpec;
  readonly measure: Measure;
}

/**
 * The PowerPoint size `steps` entries below `size`, or the smallest one when
 * the list runs out.
 */
export function stepDownSize(size: number, steps: number): number {
  const smaller = POWERPOINT_SIZES.filter(value => value < size).reverse();
  if (steps <= 0 || smaller.length === 0) return size;
  return smaller[Math.min(steps, smaller.length) - 1] ?? size;
}

/** The size of the continuation mark: two sizes below the text. */
export function contSizeOf(spec: Pick<SplitSpec, 'size'>): number {
  return stepDownSize(spec.size, 2);
}

/**
 * Wraps text in the layout, with the continuation mark when `withMarker` is
 * set.
 */
export function layoutText(
  text: string,
  layout: SplitLayout,
  withMarker = false,
): LayoutResult {
  const measured = layout.measure(text, {
    ...layout.spec,
    marker: withMarker ? CONT_MARKER : '',
    markerSize: contSizeOf(layout.spec),
  });
  if (
    !Number.isFinite(measured.maxWidth) ||
    measured.maxWidth <= 0 ||
    measured.lineWidths.some(width => !Number.isFinite(width) || width < 0)
  ) {
    throw new Error('Invalid Bible text measurement');
  }
  return measured;
}

/**
 * How full the lines are, from 0 to 1: used width over the width of `maxLines`
 * full lines.
 */
export function fillRatio(result: LayoutResult, maxLines: number): number {
  const denominator = maxLines * result.maxWidth;
  return denominator
    ? result.lineWidths.reduce((sum, width) => sum + width, 0) / denominator
    : 0;
}
