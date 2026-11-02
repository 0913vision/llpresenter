import {useEffect, type RefObject} from 'react';
import {SHORTCUT_RECORDING_SELECTOR} from '@renderer/ui/shortcutRecording';
import {isComposingKey} from '@renderer/ui/ime';
import {modalStack} from '@renderer/ui/modalStack';

const LIST_ENTRY = '[role="listbox"] [role="option"]';

/**
 * Esc and Ctrl W close a secondary window, unless a control already used the
 * key (an open menu or popup, a recording shortcut field, an IME) or a modal
 * is open, even one that does not take Esc, such as the saving dialog.
 */
export function useCloseKeys(close: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        modalStack.isOpen ||
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
 * has gone anywhere else or the user presses a key or the pointer.
 */
export function useInitialListFocus(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = root.current;
    if (element === null) return undefined;
    const placed = (): boolean => {
      if (document.activeElement !== document.body) return true;
      const entry =
        element.querySelector<HTMLElement>(
          `${LIST_ENTRY}[aria-selected="true"]`,
        ) ?? element.querySelector<HTMLElement>(LIST_ENTRY);
      if (entry === null) return false;
      entry.focus();
      return true;
    };
    const observer = new MutationObserver(() => {
      if (placed()) observer.disconnect();
    });
    const stop = (): void => observer.disconnect();
    if (placed()) return undefined;
    observer.observe(element, {childList: true, subtree: true});
    document.addEventListener('pointerdown', stop, {once: true});
    document.addEventListener('keydown', stop, {once: true});
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', stop);
      document.removeEventListener('keydown', stop);
    };
  }, [root]);
}
