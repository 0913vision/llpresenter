import {
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import {isComposing} from './ime';
import {findLayerContainer} from './layers';
import {modalStack} from './modalStack';

const TABBABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const TEXT_FIELD = 'input:not([type]), input[type="text"], textarea';
const LIST_ROLES =
  '[role="listbox"], [role="tree"], [role="grid"], [role="menu"]';
const TOGGLE_ROLES = new Set(['checkbox', 'switch']);

/** Where a modal puts focus when it opens. */
export type InitialFocus = 'text-field' | 'primary';

const PRIMARY_ATTRIBUTE = 'data-modal-primary';

/** Spread on the primary button of a modal, so that it takes focus first. */
export const PRIMARY_MARK: Readonly<Record<string, string>> = {
  [PRIMARY_ATTRIBUTE]: '',
};

export interface ModalOptions {
  readonly surface: RefObject<HTMLElement | null>;
  /** Esc: what [취소] does. Nothing happens when it is undefined. */
  readonly onEscape: (() => void) | undefined;
  /** Enter: what the primary button does, unless it is disabled. */
  readonly onEnter: (() => void) | undefined;
  readonly initialFocus: InitialFocus;
}

/**
 * Whether Enter at this target should press the primary button. Enter stays
 * with a multiline field, with lists and menus, and with a focused button
 * (which presses itself), but not with checkboxes and switches.
 */
export function enterPressesPrimary(
  target: Element,
  handledElsewhere: boolean,
): boolean {
  const role = target.getAttribute('role');
  if (role !== null && TOGGLE_ROLES.has(role)) return true;
  if (handledElsewhere) return false;
  if (target instanceof HTMLTextAreaElement) return false;
  if (target instanceof HTMLButtonElement) return false;
  return target.closest(LIST_ROLES) === null;
}

/** The elements of a surface that Tab can reach, in order. */
export function tabbableElements(surface: HTMLElement): HTMLElement[] {
  return [...surface.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    element => element.closest('[inert]') === null,
  );
}

function focusInitial(surface: HTMLElement, initialFocus: InitialFocus): void {
  const field =
    initialFocus === 'text-field'
      ? surface.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          TEXT_FIELD,
        )
      : null;
  if (field !== null) {
    field.focus();
    field.select();
    return;
  }
  const primary = surface.querySelector<HTMLElement>(`[${PRIMARY_ATTRIBUTE}]`);
  (primary ?? tabbableElements(surface)[0] ?? surface).focus();
}

// NOTE(0913vision): The notification cards stay live above a modal and come
// first in the page, so Tab cycles through their buttons and then the modal.
function focusCycle(surface: HTMLElement): HTMLElement[] {
  const notifications = findLayerContainer('notification');
  return [
    ...(notifications === null ? [] : tabbableElements(notifications)),
    ...tabbableElements(surface),
  ];
}

function cycleTarget(
  cycle: readonly HTMLElement[],
  active: Element | null,
  backward: boolean,
): {readonly next: HTMLElement | undefined; readonly wraps: boolean} {
  const index = cycle.findIndex(element => element === active);
  if (index < 0) return {next: backward ? cycle.at(-1) : cycle[0], wraps: true};
  const nextIndex = index + (backward ? -1 : 1);
  const wraps = nextIndex < 0 || nextIndex >= cycle.length;
  return {next: cycle.at(nextIndex % cycle.length), wraps};
}

// NOTE(0913vision): Inside the cards or inside the modal the browser moves
// focus as usual; between the two and at the ends of the cycle the modal does.
function moveInFocusCycle(event: KeyboardEvent, surface: HTMLElement): void {
  const active = document.activeElement;
  const {next, wraps} = cycleTarget(
    focusCycle(surface),
    active,
    event.shiftKey,
  );
  const staysInside =
    !wraps &&
    next !== undefined &&
    active !== null &&
    surface.contains(active) === surface.contains(next);
  if (staysInside) return;
  event.preventDefault();
  next?.focus();
}

function useTabCycle(surface: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = surface.current;
    if (element === null) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      if (modalStack.isTop(element)) moveInFocusCycle(event, element);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [surface]);
}

/**
 * The behavior every modal shares: everything behind it is inert, focus
 * starts inside it and cycles there and through the notification cards,
 * Enter and Esc press its buttons, and
 * focus goes back to where it was when the modal closes. The F1 to F7
 * 지우기 keys pass through, so the screens can still be cleared.
 *
 * @returns The key handler for the modal surface.
 */
export function useModal({
  surface,
  onEscape,
  onEnter,
  initialFocus,
}: ModalOptions): (event: ReactKeyboardEvent<HTMLElement>) => void {
  useEffect(() => {
    const element = surface.current;
    if (element === null) return undefined;
    // NOTE(0913vision): Read the opener here, after a menu that opened this
    // modal has closed and given focus back to its own button.
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const close = modalStack.push(element);
    focusInitial(element, initialFocus);
    return () => {
      close();
      if (opener?.isConnected === true) opener.focus();
    };
  }, [surface, initialFocus]);
  useTabCycle(surface);

  return event => {
    switch (event.key) {
      case 'Escape':
        if (
          event.defaultPrevented ||
          onEscape === undefined ||
          isComposing(event)
        ) {
          return;
        }
        event.preventDefault();
        onEscape();
        return;
      case 'Enter':
        if (
          onEnter === undefined ||
          isComposing(event) ||
          !(event.target instanceof Element) ||
          !enterPressesPrimary(event.target, event.defaultPrevented)
        ) {
          return;
        }
        event.preventDefault();
        onEnter();
        return;
      default:
        return;
    }
  };
}
