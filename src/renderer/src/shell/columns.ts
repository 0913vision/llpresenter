import {COLUMN_LIMITS} from '@core/schema/uiState';
import type {ColumnWidths} from '../ui/sizeClass';

export type DraggableColumn = 'left' | 'right';

export interface WidthRange {
  readonly min: number;
  readonly max: number;
}

/** Column width ranges and the smallest center width, in CSS pixels. */
export const COLUMN_RANGES: Readonly<Record<DraggableColumn, WidthRange>> =
  COLUMN_LIMITS;
export const CENTER_MIN_WIDTH = 560;

// NOTE(0913vision): Must match the `--panel-gap` design token.
const PANEL_GAP = 4;
const GAPS_ACROSS_COLUMNS = 4;
export const FIXED_GAPS_WIDTH = PANEL_GAP * GAPS_ACROSS_COLUMNS;

export function clamp(value: number, {min, max}: WidthRange): number {
  return Math.min(Math.max(value, min), max);
}

/** Width left for the center column, which takes all the remaining width. */
export function centerWidth(
  windowWidth: number,
  {left, right}: ColumnWidths,
): number {
  return windowWidth - FIXED_GAPS_WIDTH - left - right;
}

function widthAvailableToSides(windowWidth: number): number {
  return windowWidth - FIXED_GAPS_WIDTH - CENTER_MIN_WIDTH;
}

/**
 * Widths to show for the saved widths. Clamps them to their ranges, and when
 * the center would go under its minimum, shrinks the right column first and
 * then the left one, down to their minimums. The saved widths stay unchanged.
 */
export function fitToWindow(
  saved: ColumnWidths,
  windowWidth: number,
): ColumnWidths {
  const left = clamp(saved.left, COLUMN_RANGES.left);
  const right = clamp(saved.right, COLUMN_RANGES.right);
  let excess = left + right - widthAvailableToSides(windowWidth);
  if (excess <= 0) return {left, right};
  const shrunkRight = Math.max(right - excess, COLUMN_RANGES.right.min);
  excess -= right - shrunkRight;
  const shrunkLeft = Math.max(left - excess, COLUMN_RANGES.left.min);
  return {left: shrunkLeft, right: shrunkRight};
}

export interface DragInput {
  readonly column: DraggableColumn;
  /** Widths on screen when the drag started. */
  readonly start: ColumnWidths;
  /** Pointer movement since the drag started, positive to the right. */
  readonly delta: number;
  readonly windowWidth: number;
}

/**
 * Widths after dragging the gap beside a column. The column stays inside its
 * range and stops widening once the center reaches its minimum width. The
 * other column does not move.
 */
export function dragColumn({
  column,
  start,
  delta,
  windowWidth,
}: DragInput): ColumnWidths {
  const {min, max} = COLUMN_RANGES[column];
  const requested =
    column === 'left' ? start.left + delta : start.right - delta;
  const other = column === 'left' ? start.right : start.left;
  const roomForColumn = widthAvailableToSides(windowWidth) - other;
  const width = clamp(requested, {
    min,
    max: Math.max(min, Math.min(max, roomForColumn)),
  });
  return column === 'left'
    ? {left: width, right: start.right}
    : {left: start.left, right: width};
}
