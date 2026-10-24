import {useEffect} from 'react';
import {
  jumpLabelFor,
  outputLabel,
  outputNext,
  outputPrevious,
} from '@renderer/state/show';

const NEXT_CODES: ReadonlySet<string> = new Set([
  'ArrowRight',
  'Space',
  'PageDown',
]);
const PREVIOUS_CODES: ReadonlySet<string> = new Set(['ArrowLeft', 'PageUp']);
const SPACE_CODE = 'Space';
const NUMPAD_DIGIT = /^Numpad(\d)$/;
const PRIMARY_BUTTON = 0;

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const OWN_KEYS_SELECTOR =
  '[role="menu"], [role="dialog"], [role="alertdialog"]';
const FOCUSABLE_ON_CLICK_SELECTOR = `${EDITABLE_SELECTOR}, [data-slide-grid], [data-service-list], ${OWN_KEYS_SELECTOR}`;
const CLICKED_CONTROL_SELECTOR = 'button, [role="button"], [role="tab"]';

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

function isInside(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/**
 * Whether another part owns the key: a text field (also during an IME
 * composition), or an open menu or dialog. The 장 grid and the 예배 순서 list
 * pass the live keys on, so they are not listed here.
 */
function belongsToOthers(event: KeyboardEvent): boolean {
  return (
    event.isComposing ||
    isInside(event.target, EDITABLE_SELECTOR) ||
    isInside(event.target, OWN_KEYS_SELECTOR)
  );
}

/** Numpad digits count as the digits of the top row. */
function physicalKey(code: string): string {
  const digit = NUMPAD_DIGIT.exec(code)?.[1];
  return digit === undefined ? code : `Digit${digit}`;
}

/**
 * Handles the live keys of 진행: next 장 (→, Space, Page Down), previous 장 (←,
 * Page Up), and the 이름표 jump keys, matched by physical key. They work with
 * the 장 grid or the 예배 순서 list in focus, and a held key runs once.
 */
export function handleShowKey(event: KeyboardEvent): void {
  if (event.defaultPrevented || hasModifier(event) || belongsToOthers(event)) {
    return;
  }
  const isNext = NEXT_CODES.has(event.code);
  const isPrevious = PREVIOUS_CODES.has(event.code);
  if (isNext || isPrevious) {
    event.preventDefault();
    if (event.repeat) return;
    if (isNext) outputNext();
    else outputPrevious();
    return;
  }
  const label = jumpLabelFor(physicalKey(event.code));
  if (label === undefined) return;
  event.preventDefault();
  if (!event.repeat) outputLabel(label);
}

/**
 * Stops Space from pressing a focused button when the key is released. Space
 * activates a button on key up, and in 진행 it is the next-장 key.
 */
export function handleShowKeyUp(event: KeyboardEvent): void {
  if (event.code !== SPACE_CODE || hasModifier(event)) return;
  if (belongsToOthers(event)) return;
  event.preventDefault();
}

/**
 * A mouse click in 진행 does not move keyboard focus to the clicked button.
 * Only text fields, the 장 grid, the 예배 순서 list, and menus and dialogs take
 * focus on a click, so a later Space still means next 장.
 */
export function handleShowMouseDown(event: MouseEvent): void {
  if (event.button !== PRIMARY_BUTTON) return;
  if (!isInside(event.target, CLICKED_CONTROL_SELECTOR)) return;
  if (isInside(event.target, FOCUSABLE_ON_CLICK_SELECTOR)) return;
  event.preventDefault();
}

/** Listens for the live keys while the 진행 workspace is shown. */
export function useShowKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleShowKey);
    window.addEventListener('keyup', handleShowKeyUp);
    window.addEventListener('mousedown', handleShowMouseDown);
    return () => {
      window.removeEventListener('keydown', handleShowKey);
      window.removeEventListener('keyup', handleShowKeyUp);
      window.removeEventListener('mousedown', handleShowMouseDown);
    };
  }, []);
}
