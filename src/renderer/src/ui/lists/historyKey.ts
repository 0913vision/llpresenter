import type {KeyboardEvent} from 'react';
import {isInTextEntry} from '../fields/textEntry';

/**
 * The step back or forward that a key asks of a list's delete history:
 * Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y. Keys typed in a text field are its own.
 */
export function historyKey(
  event: Pick<
    KeyboardEvent,
    'key' | 'target' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'
  >,
): 'undo' | 'redo' | null {
  if (
    !event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    isInTextEntry(event.target)
  ) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  return key === 'y' && !event.shiftKey ? 'redo' : null;
}
