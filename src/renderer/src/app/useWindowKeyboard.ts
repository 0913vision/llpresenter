import {useEffect, type RefObject} from 'react';
import {SHORTCUT_RECORDING_SELECTOR} from '@renderer/ui/shortcutRecording';
import {isComposingKey} from '@renderer/ui/ime';

const LIST_ENTRY = '[role="listbox"] [role="option"]';

/**
 * Esc and Ctrl W close a secondary window, unless a control already used the
 * key (an open menu or popup, a recording shortcut field, an IME).
 */
export function useCloseKeys(close: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        isComposingKey(event) ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest(SHORTCUT_RECORDING_SELECTOR) !== null)
      ) {
        return;
      }
      const plainEscape = event.key === 'Escape' && !event.ctrlKey;
      const closeWindow =
        event.ctrlKey && (event.key === 'w' || event.key === 'W');
      if (!plainEscape && !closeWindow) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);
}

/**
 * Puts focus on the first list entry of a window when it opens, so a
 * keyboard or screen reader user starts inside the content instead of on
 * `body`. It waits for the content to appear, and gives up as soon as focus
 * has gone anywhere else.
 */
export function useInitialListFocus(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = root.current;
    if (element === null) return undefined;
    const observer = new MutationObserver(() => place());
    function place(): void {
      if (document.activeElement !== document.body) {
        observer.disconnect();
        return;
      }
      const entry =
        element?.querySelector<HTMLElement>(
          `${LIST_ENTRY}[aria-selected="true"]`,
        ) ?? element?.querySelector<HTMLElement>(LIST_ENTRY);
      if (entry === null || entry === undefined) return;
      entry.focus();
      observer.disconnect();
    }
    place();
    observer.observe(element, {childList: true, subtree: true});
    return () => observer.disconnect();
  }, [root]);
}
