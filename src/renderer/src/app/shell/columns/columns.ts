import {COLUMN_LIMITS} from '@core/schema/app/uiState';
import {clamp, type NumberRange} from '@core/common/range';
import type {ColumnWidths} from '@renderer/ui/panels/sizeClass';

/** The right column of 준비 has a width of its own. */
export type RightColumn = 'right' | 'prepRight';

/** A side column whose width the operator can drag. */
export type DraggableColumn = 'left' | RightColumn;

/** Column width ranges and the smallest center width, in CSS pixels. */
export const COLUMN_RANGES: Readonly<Record<DraggableColumn, NumberRange>> =
  COLUMN_LIMITS;
/** The narrowest the center column may get, in CSS pixels. */
export const CENTER_MIN_WIDTH = 560;

// NOTE(0913vision): Must match the `--panel-gap` design token.
const PANEL_GAP = 4;
const GAPS_ACROSS_COLUMNS = 4;
/** The width of the gaps between the columns, in CSS pixels. */
export const FIXED_GAPS_WIDTH = PANEL_GAP * GAPS_ACROSS_COLUMNS;

/** Width left for the center column, which takes all the remaining width. */
export function centerWidth(
  windowWidth: number,
  widths: ColumnWidths,
  right: RightColumn = 'right',
): number {
  return windowWidth - FIXED_GAPS_WIDTH - widths.left - widths[right];
}

function widthAvailableToSides(windowWidth: number): number {
  return windowWidth - FIXED_GAPS_WIDTH - CENTER_MIN_WIDTH;
}

/**
 * Widths to show for the saved widths. Clamps them to their ranges, and when
 * the center would go under its minimum, shrinks the right column first and
 * then the left one, down to their minimums. The saved widths stay unchanged.
 * `collapsedLeft` is the width 진행's left column takes while it is collapsed:
 * 진행's right column then counts only that strip, and 준비, whose left column
 * shows, keeps the left width.
 */
export function fitToWindow(
  saved: ColumnWidths,
  windowWidth: number,
  collapsedLeft?: number,
): ColumnWidths {
  const available = widthAvailableToSides(windowWidth);
  const beside = (column: RightColumn, left: number): number => {
    const range = COLUMN_RANGES[column];
    const width = clamp(saved[column], range);
    return Math.max(Math.min(width, available - left), range.min);
  };
  const wanted = clamp(saved.left, COLUMN_RANGES.left);
  const besideLeft = beside('right', wanted);
  const left = Math.max(
    Math.min(wanted, available - besideLeft),
    COLUMN_RANGES.left.min,
  );
  const right =
    collapsedLeft === undefined ? besideLeft : beside('right', collapsedLeft);
  return {left, right, prepRight: beside('prepRight', left)};
}

/** A drag of a column border: which column, from what widths, and how far. */
export interface DragInput {
  readonly column: DraggableColumn;
  /** Widths on screen when the drag started. */
  readonly start: ColumnWidths;
  /** Pointer movement since the drag started, positive to the right. */
  readonly delta: number;
  readonly windowWidth: number;
  /** The right column that is on screen. */
  readonly right: RightColumn;
  /** The width the left column takes while it is collapsed, if it is. */
  readonly collapsedLeft?: number | undefined;
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
  right,
  collapsedLeft,
}: DragInput): ColumnWidths {
  const {min, max} = COLUMN_RANGES[column];
  const requested =
    column === 'left' ? start.left + delta : start[column] - delta;
  const other =
    column === 'left' ? start[right] : (collapsedLeft ?? start.left);
  const roomForColumn = widthAvailableToSides(windowWidth) - other;
  const width = clamp(requested, {
    min,
    max: Math.max(min, Math.min(max, roomForColumn)),
  });
  return {...start, [column]: width};
}
