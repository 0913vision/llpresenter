import {useEffect} from 'react';
import {isColumnDragActive} from '@renderer/state/drag';
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
const NUM_LOCK = 'NumLock';
const PRIMARY_BUTTON = 0;

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const OWN_KEYS_SELECTOR =
  '[role="menu"], [role="dialog"], [role="alertdialog"]';
const FOCUSABLE_ON_CLICK_SELECTOR = `${EDITABLE_SELECTOR}, [data-slide-grid], [data-service-list], ${OWN_KEYS_SELECTOR}`;
const CLICKED_CONTROL_SELECTOR = 'button, [role="button"], [role="tab"]';

// NOTE(0913vision): Space activates a focused button when it is released, so
// the key up of a Space that the live handler took must be cancelled too. The
// flag links the two events.
let spaceTakenOnKeyDown = false;

interface PendingClick {
  readonly control: Element;
  readonly previousFocus: Element | null;
}

// NOTE(0913vision): The click focus rule keeps the focus where it was. The
// mouse down is not cancelled, because that would also stop a native drag from
// a draggable button. The control takes focus after the mouse down, and the
// focus-in handler puts the focus back.
let pendingClick: PendingClick | null = null;

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

function isInside(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

// NOTE(0913vision): The 장 grid and the 예배 순서 list pass the live keys on,
// so they are not owners here.
function belongsToOthers(event: KeyboardEvent): boolean {
  return (
    event.isComposing ||
    isColumnDragActive() ||
    isInside(event.target, EDITABLE_SELECTOR) ||
    isInside(event.target, OWN_KEYS_SELECTOR)
  );
}

// NOTE(0913vision): Numpad digits count as the digits of the top row only while
// Num Lock is on. With Num Lock off those keys move the cursor.
function physicalKey(event: KeyboardEvent): string {
  const digit = NUMPAD_DIGIT.exec(event.code)?.[1];
  if (digit === undefined) return event.code;
  return event.getModifierState(NUM_LOCK) ? `Digit${digit}` : event.code;
}

/**
 * Handles the live keys of 진행: next 장 (→, Space, Page Down), previous 장 (←,
 * Page Up), and the 이름표 jump keys, matched by physical key. They work with
 * the 장 grid or the 예배 순서 list in focus, a held key runs once, and they
 * stay inactive during a column drag.
 */
export function handleShowKey(event: KeyboardEvent): void {
  if (event.defaultPrevented || hasModifier(event) || belongsToOthers(event)) {
    return;
  }
  const isNext = NEXT_CODES.has(event.code);
  const isPrevious = PREVIOUS_CODES.has(event.code);
  if (isNext || isPrevious) {
    event.preventDefault();
    if (event.code === SPACE_CODE) spaceTakenOnKeyDown = true;
    if (event.repeat) return;
    if (isNext) outputNext();
    else outputPrevious();
    return;
  }
  const label = jumpLabelFor(physicalKey(event));
  if (label === undefined) return;
  event.preventDefault();
  if (!event.repeat) outputLabel(label);
}

/**
 * Cancels the key up of a Space that the live handler took on key down, so that
 * a focused button is not pressed by it.
 */
export function handleShowKeyUp(event: KeyboardEvent): void {
  if (event.code !== SPACE_CODE) return;
  const taken = spaceTakenOnKeyDown;
  spaceTakenOnKeyDown = false;
  if (taken) event.preventDefault();
}

/**
 * Notes a mouse down on a plain button or tab, to keep the keyboard focus where
 * it is. Only text fields, the 장 grid, the 예배 순서 list, and menus and
 * dialogs take focus on a click, so a later Space still means next 장.
 */
export function handleShowMouseDown(event: MouseEvent): void {
  pendingClick = null;
  if (event.button !== PRIMARY_BUTTON) return;
  if (isInside(event.target, FOCUSABLE_ON_CLICK_SELECTOR)) return;
  const control =
    event.target instanceof Element
      ? event.target.closest(CLICKED_CONTROL_SELECTOR)
      : null;
  if (control) {
    pendingClick = {control, previousFocus: document.activeElement};
  }
}

/** Puts the focus back when a mouse down made a plain button take it. */
export function handleShowFocusIn(event: FocusEvent): void {
  const click = pendingClick;
  if (!click) return;
  if (event.target !== click.control) return;
  pendingClick = null;
  const {previousFocus} = click;
  if (
    previousFocus instanceof HTMLElement &&
    previousFocus.isConnected &&
    previousFocus !== document.body &&
    previousFocus !== click.control
  ) {
    previousFocus.focus({preventScroll: true});
  } else if (click.control instanceof HTMLElement) {
    click.control.blur();
  }
}

function handleShowMouseUp(): void {
  pendingClick = null;
}

/** Listens for the live keys while the 진행 workspace is shown. */
export function useShowKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleShowKey);
    window.addEventListener('keyup', handleShowKeyUp);
    window.addEventListener('mousedown', handleShowMouseDown);
    window.addEventListener('focusin', handleShowFocusIn);
    window.addEventListener('mouseup', handleShowMouseUp);
    return () => {
      window.removeEventListener('keydown', handleShowKey);
      window.removeEventListener('keyup', handleShowKeyUp);
      window.removeEventListener('mousedown', handleShowMouseDown);
      window.removeEventListener('focusin', handleShowFocusIn);
      window.removeEventListener('mouseup', handleShowMouseUp);
    };
  }, []);
}
