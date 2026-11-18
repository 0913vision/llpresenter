import {useEffect} from 'react';
import {
  dispatchShortcut,
  type WindowShortcut,
} from '@renderer/ui/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {isColumnDragActive} from '@renderer/platform/drag';
import {CLICK_FOCUS_SELECTOR} from '@renderer/ui';
import {
  openNextItem,
  openPreviousItem,
  outputBoundarySlide,
  outputNext,
  outputPrevious,
  revealLiveItem,
} from '@renderer/session/show';
import {useAtLastSlide} from './useAtLastSlide';
import {useSlideHotKeys} from './useSlideHotKeys';
import {outputAdjacentBibleVerse} from '../bible/verseShortcuts';
import {clearLayer} from '@renderer/session/clear';
import {
  canReturnFromQuickPassage,
  returnFromQuickPassage,
} from '@renderer/session/quickReturn';
import {useNumberJumpKeys} from './numberJump';
import {returnFocus} from '@renderer/ui/returnFocus';

const commands: readonly WindowShortcut[] = [
  {
    id: 'show.quickReturn',
    fixedBindings: [{code: 'Escape', mods: []}],
    when: canReturnFromQuickPassage,
    run: returnFromQuickPassage,
  },
  {id: 'show.black', run: () => clearLayer('all')},
  {id: 'show.next', run: () => outputNext()},
  {id: 'show.previous', run: () => outputPrevious()},
  {id: 'show.first', run: () => outputBoundarySlide('first')},
  {id: 'show.last', run: () => outputBoundarySlide('last')},
  {id: 'service.nextItem', run: () => openNextItem()},
  {id: 'service.previousItem', run: () => openPreviousItem()},
  {id: 'service.revealLive', run: () => revealLiveItem()},
  ...(['next', 'previous'] as const).map(direction => ({
    id: direction === 'next' ? 'bible.nextVerse' : 'bible.previousVerse',
    run: () => {
      outputAdjacentBibleVerse(direction).catch((cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Could not handle the Bible verse key',
          detail: String(cause),
        }),
      );
    },
  })),
];
const SPACE_CODE = 'Space';
const PRIMARY_BUTTON = 0;

const CLICKED_CONTROL_SELECTOR =
  'button, [role="button"], [role="tab"], [role="option"], [tabindex]';

function takesShowClickFocus(target: Element): boolean {
  if (document.querySelector('[data-workspace-layout="show"]') === null) {
    return target.closest(CLICK_FOCUS_SELECTOR) !== null;
  }
  return (
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"], [role="alertdialog"], [data-show-slide-grid], [data-panel="예배 순서"] [role="listbox"]',
    ) !== null
  );
}

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

/** Handles navigation through the shared command dispatcher. */
export function handleShowKey(event: KeyboardEvent): void {
  pendingClick = null;
  if (event.code === SPACE_CODE && !event.repeat) spaceTakenOnKeyDown = false;
  if (isColumnDragActive()) return;
  dispatchShortcut(event, commands, 'bubble');
  if (event.code === SPACE_CODE && event.defaultPrevented) {
    spaceTakenOnKeyDown = true;
  }
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
  if (event.target instanceof Element && takesShowClickFocus(event.target)) {
    return;
  }
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
  if (!click) {
    const from = event.relatedTarget;
    const target = event.target;
    if (
      from instanceof Element &&
      from.closest('[role="menu"], [role="dialog"], [role="alertdialog"]') !==
        null &&
      target instanceof HTMLElement &&
      target.closest('[role="menu"], [role="dialog"], [role="alertdialog"]') ===
        null
    ) {
      queueMicrotask(() => {
        if (
          document.activeElement === target &&
          document.querySelector(
            '[role="menu"], [role="dialog"], [role="alertdialog"]',
          ) === null
        ) {
          returnFocus(target);
        }
      });
    }
    return;
  }
  if (event.target !== click.control) return;
  pendingClick = null;
  const {previousFocus} = click;
  if (
    previousFocus instanceof HTMLElement &&
    previousFocus.isConnected &&
    previousFocus !== document.body &&
    previousFocus !== click.control
  ) {
    returnFocus(previousFocus);
  } else if (click.control instanceof HTMLElement) {
    returnFocus(null);
    if (document.activeElement === click.control) click.control.blur();
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
  if (event.type === 'click' && click?.control === document.activeElement) {
    queueMicrotask(() => {
      if (
        click.control === document.activeElement &&
        document.querySelector(
          '[role="menu"], [role="dialog"], [role="alertdialog"]',
        ) === null
      ) {
        returnFocus(null);
      }
    });
  }
  pendingClick = null;
}

/** A pointer click outside a focus-owning surface returns to slide keys. */
function returnAfterShowClick(event: MouseEvent): void {
  if (
    event.button !== PRIMARY_BUTTON ||
    event.detail === 0 ||
    !(event.target instanceof Element)
  ) {
    return;
  }
  const target = event.target;
  const show = document.querySelector('[data-workspace-layout="show"]');
  if (
    show === null ||
    (!show.contains(target) &&
      target.closest('[data-window-menu-bar], [data-workspace-toolbar]') ===
        null) ||
    takesShowClickFocus(target)
  ) {
    return;
  }
  const label = target.closest('label');
  if (label?.control?.matches('input, textarea, select')) return;
  queueMicrotask(() => {
    if (
      document.querySelector('[data-workspace-layout="show"]') !== null &&
      document.querySelector(
        '[role="menu"], [role="dialog"], [role="alertdialog"]',
      ) === null
    ) {
      returnFocus(null);
    }
  });
}

/** Listens for the live keys while the 진행 workspace is shown. */
export function useShowKeys(): void {
  useNumberJumpKeys();
  useSlideHotKeys();
  useAtLastSlide();
  useWindowShortcuts(commands);
  useEffect(() => {
    window.addEventListener('keydown', clearPendingClick, {capture: true});
    window.addEventListener('mousedown', handleShowMouseDown);
    window.addEventListener('focusin', handleShowFocusIn);
    window.addEventListener('mouseup', clearPendingClick);
    window.addEventListener('click', clearPendingClick);
    window.addEventListener('click', returnAfterShowClick);
    window.addEventListener('dragend', clearPendingClick);
    window.addEventListener('blur', resetPendingInput);
    return () => {
      resetPendingInput();
      window.removeEventListener('keydown', clearPendingClick, {capture: true});
      window.removeEventListener('mousedown', handleShowMouseDown);
      window.removeEventListener('focusin', handleShowFocusIn);
      window.removeEventListener('mouseup', clearPendingClick);
      window.removeEventListener('click', clearPendingClick);
      window.removeEventListener('click', returnAfterShowClick);
      window.removeEventListener('dragend', clearPendingClick);
      window.removeEventListener('blur', resetPendingInput);
    };
  }, []);
}
