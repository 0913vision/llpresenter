import type {SizeClass} from '@core/schema/app/appConfig';

const NORMAL_MIN_WIDTH = 1600;
const WIDE_MIN_WIDTH = 2400;

/** The size class of a window `width` CSS pixels wide. */
export function sizeClassFor(width: number): SizeClass {
  if (width >= WIDE_MIN_WIDTH) return 'wide';
  if (width >= NORMAL_MIN_WIDTH) return 'normal';
  return 'narrow';
}

/** The widths of the side columns, in CSS pixels. */
export interface ColumnWidths {
  readonly left: number;
  readonly right: number;
  /** The right column of 준비, which holds properties. */
  readonly prepRight: number;
}

/** Default column widths per size class (design system tokens `col-*`). */
export const defaultColumns: Readonly<Record<SizeClass, ColumnWidths>> = {
  narrow: {left: 220, right: 360, prepRight: 300},
  normal: {left: 280, right: 480, prepRight: 320},
  wide: {left: 320, right: 640, prepRight: 400},
};

/** Default thumbnail columns of the 장 grid per size class (design system `Layout`). */
export const defaultThumbnailColumns: Readonly<Record<SizeClass, number>> = {
  narrow: 3,
  normal: 4,
  wide: 6,
};
