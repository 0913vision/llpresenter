import type {KeyboardEvent} from 'react';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';

/** What the rules read of a key press: the key and where it was pressed. */
type KeyPress = Pick<KeyboardEvent<HTMLElement>, 'key' | 'target'>;

/** The fields that search the passage, 책, 장 and 절, as the form marks them. */
const SEARCH_FIELD = '[data-reference-part]';

/** Whether the open book list under the 책 field takes this key. */
export function bookListTakes(event: KeyPress): boolean {
  return (
    event.target instanceof HTMLInputElement &&
    event.target.dataset['referencePart'] === 'book' &&
    event.target.getAttribute('aria-expanded') === 'true' &&
    ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)
  );
}

/**
 * Whether the recent passages take this key (↑, ↓ and Enter). A text box
 * keeps its own keys, so they take it only when no text box has the focus, or
 * from a field that searches the passage, as a search field's results do; the
 * 책 field's open book list comes first for its own keys.
 */
export function recentListTakes(event: KeyPress): boolean {
  const {target} = event;
  if (!isInTextEntry(target)) return true;
  return (
    target instanceof Element &&
    target.matches(SEARCH_FIELD) &&
    !bookListTakes(event)
  );
}
