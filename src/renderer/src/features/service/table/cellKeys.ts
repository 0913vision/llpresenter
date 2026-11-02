import type {KeyboardEvent} from 'react';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {TABLE_CELL} from './CellButton';

const ROW = '[role="option"]';
const CELLS = `[${TABLE_CELL}]`;
const OWN_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Delete',
  'Backspace',
  'F2',
]);

function take(event: KeyboardEvent, keepDefault = false): void {
  if (!keepDefault) event.preventDefault();
  event.stopPropagation();
}

/**
 * The keys that move between a row and its cells. From a selected row,
 * ArrowRight moves into its first cell, ArrowLeft and ArrowRight move between
 * cells, Enter opens the cell, and Esc or ArrowLeft from the first cell goes
 * back to the row. Mount it as the capture handler of the table, so the list's
 * keys and the window shortcuts (Delete, rename) never act on a cell.
 */
export function handleCellKey(event: KeyboardEvent<HTMLElement>): void {
  const {target} = event;
  if (!(target instanceof HTMLElement) || isComposing(event)) return;
  if (isInTextEntry(target) || hasModifier(event)) return;
  const row = target.closest<HTMLElement>(ROW);
  if (row === null) return;
  const cells = Array.from(row.querySelectorAll<HTMLElement>(CELLS));
  if (target === row) {
    const first = cells[0];
    if (event.key === 'ArrowRight' && first !== undefined) {
      take(event);
      first.focus();
    }
    return;
  }
  const at = cells.indexOf(target);
  if (at < 0) return;
  if (event.key === 'ArrowRight') {
    take(event);
    cells[at + 1]?.focus();
  } else if (event.key === 'ArrowLeft') {
    take(event);
    (cells[at - 1] ?? row).focus();
  } else if (event.key === 'Escape') {
    take(event);
    row.focus();
  } else if (event.key === 'Enter' || event.key === ' ') {
    take(event, true);
  } else if (OWN_KEYS.has(event.key)) {
    take(event);
  }
}
