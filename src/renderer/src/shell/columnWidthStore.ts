import type {LayoutChange, UiState} from '@shared/schema/uiState';
import {clamp, COLUMN_RANGES} from './columns';
import type {ColumnWidths, SizeClass} from './sizeClass';

/** Remembers the column widths that the operator set, per size class. */
export interface ColumnWidthStore {
  load(sizeClass: SizeClass): ColumnWidths | undefined;
  save(sizeClass: SizeClass, widths: ColumnWidths): void;
}

export function createMemoryColumnWidthStore(): ColumnWidthStore {
  const saved = new Map<SizeClass, ColumnWidths>();
  return {
    load: sizeClass => saved.get(sizeClass),
    save: (sizeClass, widths) => {
      saved.set(sizeClass, widths);
    },
  };
}

/**
 * A store that starts from the saved UI state and sends each saved width to the
 * main process. The widths go out as whole pixels inside their ranges, which is
 * all the main process accepts. A saved width outside its range, which the
 * layout shows clamped, is sent clamped too.
 *
 * @param send - Called once per save, with the widths of one size class.
 */
export function createIpcColumnWidthStore(
  initial: UiState,
  send: (change: LayoutChange) => void,
): ColumnWidthStore {
  const changed = new Map<SizeClass, ColumnWidths>();
  return {
    load: sizeClass => {
      const known = changed.get(sizeClass);
      if (known) return known;
      const entry = initial.layout?.[sizeClass];
      if (entry?.left === undefined || entry.right === undefined) {
        return undefined;
      }
      return {left: entry.left, right: entry.right};
    },
    save: (sizeClass, widths) => {
      const left = clamp(Math.round(widths.left), COLUMN_RANGES.left);
      const right = clamp(Math.round(widths.right), COLUMN_RANGES.right);
      changed.set(sizeClass, {left, right});
      send({sizeClass, left, right});
    },
  };
}
