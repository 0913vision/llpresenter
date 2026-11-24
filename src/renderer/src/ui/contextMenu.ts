import type {KeyboardEvent, MouseEvent} from 'react';
import type {MenuAnchor} from '@renderer/ui/Menu';
import './contextMenu.css';

export type ContextMenuEvent =
  MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

const marks = new WeakMap<HTMLElement, number>();

export function contextMenuTarget(
  event: ContextMenuEvent,
): HTMLElement | undefined {
  if (!(event.target instanceof Element)) return undefined;
  const row = event.target.closest<HTMLElement>(
    '[data-menu-row], [data-order-id], [data-value], [role="option"], [role^="menuitem"], [role="radio"], [role="tab"]',
  );
  if (row !== null) return row;
  const group = event.target.closest<HTMLElement>('[role="group"][tabindex]');
  const rows =
    '[data-menu-row], [data-order-id], [data-value], [role="option"]';
  if (group !== null && !group.querySelector(rows)) return group;
  const button = event.target.closest<HTMLElement>('button');
  if (button !== null) return button;
  return event.currentTarget.querySelector(rows)
    ? undefined
    : event.currentTarget;
}

/** Opens a menu at the pointer of a right click, marking the row under it. */
export function pointerMenuAnchor(event: MouseEvent<HTMLElement>): MenuAnchor {
  return {
    kind: 'point',
    target: contextMenuTarget(event),
    point: {x: event.clientX, y: event.clientY},
  };
}

export function markMenuTarget(target: HTMLElement): () => void {
  marks.set(target, (marks.get(target) ?? 0) + 1);
  target.setAttribute('data-menu-target', '');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (marks.get(target) ?? 1) - 1;
    if (remaining > 0) {
      marks.set(target, remaining);
      return;
    }
    marks.delete(target);
    target.removeAttribute('data-menu-target');
  };
}

export function isContextMenuKey(event: KeyboardEvent): boolean {
  if (
    event.nativeEvent.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.target instanceof Element &&
      event.target.closest('input, textarea, [contenteditable="true"]'))
  ) {
    return false;
  }
  return (
    (event.key === 'ContextMenu' && !event.shiftKey) ||
    (event.key === 'F10' && event.shiftKey)
  );
}

/** The `button` of a contextmenu event that the keyboard sent. */
const KEYBOARD_BUTTON = -1;

/**
 * Drops the contextmenu event that Chromium sends when the Menu key is let
 * go. A menu opened on the key's press keeps its focus; without this, the
 * late event would open the menu again behind it.
 */
export function dropKeyContextMenu(): void {
  window.addEventListener(
    'contextmenu',
    event => {
      if (event.button !== KEYBOARD_BUTTON) return;
      event.preventDefault();
      event.stopPropagation();
    },
    {capture: true, once: true},
  );
}

/**
 * Takes a press of the Menu key or Shift F10 for a menu that opens now: the
 * press stops here, so no menu above opens too, and the contextmenu the key
 * sends when it is let go is dropped, so the menu opens once and keeps its
 * focus. Every list opens its menu from the keyboard through this.
 *
 * @returns Whether the press was the menu key.
 */
export function takeMenuKey(event: KeyboardEvent): boolean {
  if (!isContextMenuKey(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  dropKeyContextMenu();
  return true;
}

/**
 * Opens a row's menu from the Menu key or Shift F10, below the row that has
 * focus. A key typed in a field, during composition, or with another modifier
 * is left alone.
 *
 * @returns Whether the press opened the menu.
 */
export function openMenuFromKey(
  event: KeyboardEvent<HTMLElement>,
  open: (anchor: MenuAnchor) => void,
): boolean {
  if (!takeMenuKey(event)) return false;
  open({
    kind: 'element',
    target: contextMenuTarget(event),
    element: event.currentTarget,
  });
  return true;
}

export function contextMenuAnchor(event: ContextMenuEvent): MenuAnchor {
  const target = contextMenuTarget(event);
  if ('clientX' in event && (event.clientX !== 0 || event.clientY !== 0)) {
    return {kind: 'point', point: {x: event.clientX, y: event.clientY}, target};
  }
  const row =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-value]')
      : null;
  return {kind: 'element', element: row ?? event.currentTarget, target};
}

/**
 * Passes a right-click that landed on the layer behind an open menu on to
 * what is under the pointer, so it opens its own menu there, as in Windows.
 * Whether the click reaches that element by itself depends on how fast the
 * old menu closes, so the layer always passes it on.
 */
export function passContextMenu(
  event: globalThis.MouseEvent,
  layer: Element | null,
): void {
  // NOTE(0913vision): jsdom, used by the tests, has no elementsFromPoint.
  const below = (
    typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(event.clientX, event.clientY)
      : []
  ).find(element => !layer?.contains(element));
  below?.dispatchEvent(
    new globalThis.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 2,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    }),
  );
}
