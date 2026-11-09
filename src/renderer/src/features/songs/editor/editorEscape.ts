import {isComposingKey} from '@renderer/ui/ime';
import {modalStack} from '@renderer/ui/modalStack';
import {isInTextEntry} from '@renderer/ui/textEntry';

/** Whether an unmodified Escape belongs to the inline editor's back action. */
export function isEditorEscape(
  event: KeyboardEvent,
  root: HTMLElement | null,
): boolean {
  const target = event.target;
  return (
    root !== null &&
    target instanceof Element &&
    (target === document.body ||
      root.contains(target) ||
      target.closest('[data-editor-escape-zone]') !== null) &&
    !event.defaultPrevented &&
    event.key === 'Escape' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    !isComposingKey(event) &&
    !isInTextEntry(event.target) &&
    !modalStack.isOpen &&
    document.querySelector('[data-llp-layer="popover"] [role="menu"]') === null
  );
}
