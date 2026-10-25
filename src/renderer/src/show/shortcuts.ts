import {useEffect} from 'react';
import {isColumnDragActive} from '@renderer/state/drag';
import {CLICK_FOCUS_SELECTOR} from '@renderer/ui';
import {
  jumpLabelFor,
  openNextItem,
  openPreviousItem,
  outputLabel,
  outputNext,
  outputPrevious,
  revealLiveItem,
} from '@renderer/state/show';

const NEXT_CODES: ReadonlySet<string> = new Set([
  'ArrowRight',
  'Space',
  'PageDown',
]);
const PREVIOUS_CODES: ReadonlySet<string> = new Set(['ArrowLeft', 'PageUp']);
const SPACE_CODE = 'Space';

// NOTE(0913vision): Command ids of docs/spec/10-shortcuts-and-settings.md. They
// select or open an item and output nothing, so a held key may repeat.
// `editsText` marks the Ctrl arrows, which move the caret in a text field.
const ITEM_COMMANDS: ReadonlyArray<{
  readonly id: string;
  readonly code: string;
  readonly editsText: boolean;
  readonly run: () => void;
}> = [
  {
    id: 'service.nextItem',
    code: 'ArrowDown',
    editsText: true,
    run: () => openNextItem(),
  },
  {
    id: 'service.previousItem',
    code: 'ArrowUp',
    editsText: true,
    run: () => openPreviousItem(),
  },
  {
    id: 'service.revealLive',
    code: 'KeyL',
    editsText: false,
    run: () => revealLiveItem(),
  },
];
const NUMPAD_DIGIT = /^Numpad(\d)$/;
const NUM_LOCK = 'NumLock';
const PRIMARY_BUTTON = 0;

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const TEXT_FIELD_SELECTOR =
  'textarea, [contenteditable="true"], input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="color"], [type="file"], [type="image"])';
const OWN_KEYS_SELECTOR =
  '[role="menu"], [role="dialog"], [role="alertdialog"]';
const CLICKED_CONTROL_SELECTOR = 'button, [role="button"], [role="tab"]';
const PASSING_PARTS_SELECTOR = '[role="listbox"]';
const PRESS_CONTROL_SELECTOR =
  'button, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"]';
const ARROW_CONTROL_SELECTOR = '[role="tab"], [role="radio"]';
const ARROW_CODES: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight']);

// NOTE(0913vision): Space activates a focused button when it is released, so
// the key up of a Space that the live handler took must be cancelled too. The
// flag links the two events.
let spaceTakenOnKeyDown = false;

interface PendingClick {
  readonly control: Element;
  readonly previousFocus: Element | null;
  readonly label: HTMLLabelElement | null;
}

// NOTE(0913vision): The click focus rule keeps the focus where it was. The
// mouse down is not cancelled, because that would also stop a native drag from
// a draggable button. The control takes focus after the mouse down, and the
// focus-in handler puts the focus back.
let pendingClick: PendingClick | null = null;

// NOTE(0913vision): Both flags describe an event that may never come: a mouse
// down whose focus-in or mouse up does not follow (a native drag), and a Space
// whose key up is missed (the window lost focus, or the listener was gone).
// They are cleared whenever such a gap is possible.
function resetPendingInput(): void {
  pendingClick = null;
  spaceTakenOnKeyDown = false;
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

function isControlOnly(event: KeyboardEvent): boolean {
  return event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
}

function isInside(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

// NOTE(0913vision): A button, switch, checkbox, radio, or tab that the operator
// reached with Tab takes Space to press it, and a tab or radio also takes ←
// and →. The 장 grid and the 예배 순서 list pass those keys on, so their
// buttons do not count.
function isTakenByFocusedControl(event: KeyboardEvent): boolean {
  if (isInside(event.target, PASSING_PARTS_SELECTOR)) return false;
  if (event.code === SPACE_CODE) {
    return isInside(event.target, PRESS_CONTROL_SELECTOR);
  }
  if (ARROW_CODES.has(event.code)) {
    return isInside(event.target, ARROW_CONTROL_SELECTOR);
  }
  return false;
}

function ownsEveryKey(event: KeyboardEvent): boolean {
  return (
    event.isComposing ||
    isColumnDragActive() ||
    isInside(event.target, OWN_KEYS_SELECTOR)
  );
}

function belongsToFocusedControl(event: KeyboardEvent): boolean {
  return (
    isInside(event.target, EDITABLE_SELECTOR) || isTakenByFocusedControl(event)
  );
}

function runItemCommand(event: KeyboardEvent): void {
  const command = ITEM_COMMANDS.find(item => item.code === event.code);
  if (command === undefined) return;
  if (command.editsText && isInside(event.target, TEXT_FIELD_SELECTOR)) return;
  event.preventDefault();
  command.run();
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
  pendingClick = null;
  if (event.code === SPACE_CODE && !event.repeat) spaceTakenOnKeyDown = false;
  if (event.defaultPrevented || ownsEveryKey(event)) return;
  if (isControlOnly(event)) {
    runItemCommand(event);
    return;
  }
  if (hasModifier(event) || belongsToFocusedControl(event)) return;
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
 * Notes a mouse down on a button, tab, or its label, to keep keyboard focus
 * where it is. Text fields, the slide grid, the service list, menus, and
 * dialogs take focus on a click, so a later Space still means next slide.
 */
export function handleShowMouseDown(event: MouseEvent): void {
  pendingClick = null;
  if (event.button !== PRIMARY_BUTTON) return;
  if (isInside(event.target, CLICK_FOCUS_SELECTOR)) return;
  if (!(event.target instanceof Element)) return;
  const directControl = event.target.closest(CLICKED_CONTROL_SELECTOR);
  const label = event.target.closest('label');
  const associatedLabel = label instanceof HTMLLabelElement ? label : null;
  const control = directControl ?? associatedLabel?.control;
  if (control?.matches(CLICKED_CONTROL_SELECTOR)) {
    pendingClick = {
      control,
      previousFocus: document.activeElement,
      label: directControl === null ? associatedLabel : null,
    };
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

function clearPendingClick(event: Event): void {
  const click = pendingClick;
  // NOTE(0913vision): A label focuses its control as the click's default
  // action, after mouseup and the label's own click have bubbled.
  if (
    !event.defaultPrevented &&
    event.target instanceof Node &&
    click?.label?.contains(event.target) &&
    (event.type === 'mouseup' ||
      (event.type === 'click' && !click.control.contains(event.target)))
  ) {
    return;
  }
  pendingClick = null;
}

/** Listens for the live keys while the 진행 workspace is shown. */
export function useShowKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleShowKey);
    window.addEventListener('keyup', handleShowKeyUp);
    window.addEventListener('mousedown', handleShowMouseDown);
    window.addEventListener('focusin', handleShowFocusIn);
    window.addEventListener('mouseup', clearPendingClick);
    window.addEventListener('click', clearPendingClick);
    window.addEventListener('dragend', clearPendingClick);
    window.addEventListener('blur', resetPendingInput);
    return () => {
      resetPendingInput();
      window.removeEventListener('keydown', handleShowKey);
      window.removeEventListener('keyup', handleShowKeyUp);
      window.removeEventListener('mousedown', handleShowMouseDown);
      window.removeEventListener('focusin', handleShowFocusIn);
      window.removeEventListener('mouseup', clearPendingClick);
      window.removeEventListener('click', clearPendingClick);
      window.removeEventListener('dragend', clearPendingClick);
      window.removeEventListener('blur', resetPendingInput);
    };
  }, []);
}
