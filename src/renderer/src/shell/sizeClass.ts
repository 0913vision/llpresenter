import type {SizeClass} from '@shared/schema/appConfig';

/** Window size classes, in CSS pixels after Windows display scaling. */
export type {SizeClass};

const NORMAL_MIN_WIDTH = 1600;
const WIDE_MIN_WIDTH = 2400;

export function sizeClassFor(width: number): SizeClass {
  if (width >= WIDE_MIN_WIDTH) return 'wide';
  if (width >= NORMAL_MIN_WIDTH) return 'normal';
  return 'narrow';
}

export interface ColumnWidths {
  readonly left: number;
  readonly right: number;
}

/** Default column widths per size class (design system tokens `col-*`). */
export const defaultColumns: Readonly<Record<SizeClass, ColumnWidths>> = {
  narrow: {left: 220, right: 360},
  normal: {left: 280, right: 480},
  wide: {left: 320, right: 560},
};

/** Default thumbnail columns of the 장 grid per size class (design system `Layout`). */
export const defaultThumbnailColumns: Readonly<Record<SizeClass, number>> = {
  narrow: 3,
  normal: 4,
  wide: 6,
};
