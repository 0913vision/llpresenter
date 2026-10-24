/** Window size classes, in CSS pixels after Windows display scaling. */
export type SizeClass = 'compact' | 'regular' | 'wide';

const REGULAR_MIN_WIDTH = 1600;
const WIDE_MIN_WIDTH = 2400;

export function sizeClassFor(width: number): SizeClass {
  if (width >= WIDE_MIN_WIDTH) return 'wide';
  if (width >= REGULAR_MIN_WIDTH) return 'regular';
  return 'compact';
}

export interface ColumnWidths {
  readonly left: number;
  readonly right: number;
}

/** Default column widths per size class (design system tokens `col-*`). */
export const defaultColumns: Readonly<Record<SizeClass, ColumnWidths>> = {
  compact: {left: 220, right: 360},
  regular: {left: 280, right: 480},
  wide: {left: 320, right: 560},
};
