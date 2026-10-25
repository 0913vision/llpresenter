import type {KeyboardEvent} from 'react';
import type {BlockCommand, BlockSelection} from './blockEdits';

type EditorCommand = BlockCommand | 'undo' | 'redo';

/** Editing commands use physical modifier keys and leave Alt/IME to Windows. */
export function editorCommand(
  event: KeyboardEvent<HTMLTextAreaElement>,
): EditorCommand | undefined {
  if (event.altKey || event.metaKey) return undefined;
  if (event.ctrlKey) {
    if (event.code === 'KeyZ') return event.shiftKey ? 'redo' : 'undo';
    if (event.code === 'KeyY' && !event.shiftKey) return 'redo';
    if (event.code === 'KeyN' && event.shiftKey) return {type: 'insert'};
    if (event.key === 'Enter' && !event.shiftKey) return {type: 'split'};
    return undefined;
  }
  if (event.shiftKey) return undefined;
  if (event.key === 'Enter') return {type: 'enter'};
  const {selectionStart, selectionEnd} = event.currentTarget;
  if (event.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
    return {type: 'merge'};
  }
  return undefined;
}

/** Crosses a block boundary at a logical line edge, preserving the column. */
export function adjacentBlock(
  event: KeyboardEvent<HTMLTextAreaElement>,
  texts: readonly string[],
  block: number,
): BlockSelection | undefined {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
    return undefined;
  }
  const input = event.currentTarget;
  if (input.selectionStart !== input.selectionEnd) return undefined;
  const before = input.value.slice(0, input.selectionStart);
  const after = input.value.slice(input.selectionEnd);
  if (event.key === 'ArrowUp' && !before.includes('\n') && block > 0) {
    const previous = texts[block - 1] ?? '';
    const lineStart = previous.lastIndexOf('\n') + 1;
    const start = Math.min(previous.length, lineStart + before.length);
    return {block: block - 1, start, end: start};
  }
  if (event.key === 'ArrowDown' && !after.includes('\n')) {
    const next = texts[block + 1];
    if (next === undefined) return undefined;
    const column = before.length - before.lastIndexOf('\n') - 1;
    const start = Math.min(column, next.split('\n')[0]?.length ?? 0);
    return {block: block + 1, start, end: start};
  }
  return undefined;
}
