import {useEffect, useEffectEvent, type RefObject} from 'react';
import {isComposingKey} from '@renderer/ui/fields/ime';
import {modalStack} from '@renderer/ui/popups/modalStack';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';

const MENU = '[data-llp-layer="popover"] [role="menu"]';

/** The slides have their own Escape, which clears a selection first. */
function leavesEditor(event: KeyboardEvent, root: HTMLElement | null): boolean {
  const {target} = event;
  if (
    root === null ||
    !(target instanceof Element) ||
    root.closest('[inert]') !== null ||
    event.defaultPrevented ||
    event.key !== 'Escape' ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isComposingKey(event) ||
    isInTextEntry(target) ||
    modalStack.isOpen ||
    document.querySelector(MENU) !== null
  ) {
    return false;
  }
  if (target.closest('[data-slide-surface]') !== null) return false;
  return (
    target === document.body ||
    root.contains(target) ||
    target.closest('[data-editor-escape-zone]') !== null
  );
}

/** Esc leaves the editor, wherever in it the focus is. */
export function useEditorBack(
  root: RefObject<HTMLElement | null>,
  onBack: () => void,
): void {
  const escape = useEffectEvent((event: KeyboardEvent): void => {
    if (!leavesEditor(event, root.current)) return;
    event.preventDefault();
    event.stopPropagation();
    onBack();
  });
  useEffect(() => {
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, []);
}
