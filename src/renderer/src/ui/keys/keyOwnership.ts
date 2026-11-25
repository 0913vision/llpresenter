import {textBoxHasKey} from '../fields/textEntry';

/** Whether the event happened inside an element that matches the selector. */
export function isInside(
  target: EventTarget | null,
  selector: string,
): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/**
 * Whether the focused control takes this key itself, before any shortcut: a
 * list its arrows, Home, End and Enter; a button, tab, check box or field its
 * Space and Enter; a tab, slider, field or tile list its arrows. The 진행 slide
 * grid leaves its arrows and Enter to the slide keys, and a canvas or chips
 * leave every key to their commands. A key with Ctrl, Alt or Shift is never
 * the control's.
 */
export function focusedControlOwnsKey(event: KeyboardEvent): boolean {
  if (
    isInside(
      event.target,
      '[data-command-context="canvas"], [data-command-context="chips"]',
    )
  ) {
    return false;
  }
  if (event.ctrlKey || event.altKey || event.shiftKey) return false;
  if (
    ['ArrowUp', 'ArrowDown', 'Enter', 'NumpadEnter', 'Home', 'End'].includes(
      event.code,
    ) &&
    isInside(event.target, '[data-show-slide-grid="true"] [role="listbox"]')
  ) {
    return false;
  }
  if (isInside(event.target, '[role="listbox"]')) {
    return [
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Enter',
      'NumpadEnter',
    ].includes(event.code);
  }
  if (['Space', 'Enter', 'NumpadEnter'].includes(event.code)) {
    return isInside(
      event.target,
      'button, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], input, select',
    );
  }
  return (
    event.code.startsWith('Arrow') &&
    isInside(
      event.target,
      '[role="tab"], [role="radio"], [role="slider"], input, select, [data-tile-list]',
    )
  );
}

/** Whether this event belongs to a text-editing control. */
export function isTextField(event: KeyboardEvent): boolean {
  return textBoxHasKey(event.target);
}
