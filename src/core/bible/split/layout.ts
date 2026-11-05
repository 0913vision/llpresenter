export const CONT_MARKER = ' (계속)';
export const POWERPOINT_SIZES = [
  8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60,
  66, 72, 80, 88, 96,
] as const;

export interface SplitSpec {
  readonly font: string;
  readonly size: number;
  readonly tracking: number;
  readonly width: number;
  readonly maxLines: number;
  readonly markerTracking: number;
}

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

export interface SplitLayout {
  readonly spec: SplitSpec;
  readonly measure: Measure;
}

export function stepDownSize(size: number, steps: number): number {
  const smaller = POWERPOINT_SIZES.filter(value => value < size).reverse();
  if (steps <= 0 || smaller.length === 0) return size;
  return smaller[Math.min(steps, smaller.length) - 1] ?? size;
}

export function contSizeOf(spec: Pick<SplitSpec, 'size'>): number {
  return stepDownSize(spec.size, 2);
}

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

export function fillRatio(result: LayoutResult, maxLines: number): number {
  const denominator = maxLines * result.maxWidth;
  return denominator
    ? result.lineWidths.reduce((sum, width) => sum + width, 0) / denominator
    : 0;
}
