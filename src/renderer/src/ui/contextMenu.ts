import type {KeyboardEvent, MouseEvent} from 'react';
import type {MenuAnchor} from '@renderer/ui/Menu';
import './contextMenu.css';

export type ContextMenuEvent =
  MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

const marks = new WeakMap<HTMLElement, number>();

export function contextMenuTarget(event: ContextMenuEvent): HTMLElement {
  const row =
    event.target instanceof Element
      ? (event.target.closest<HTMLElement>(
          '[data-order-id], [data-value], [role="option"], [role^="menuitem"], [role="radio"], [role="tab"], [role="group"][tabindex]',
        ) ?? event.target.closest<HTMLElement>('button'))
      : null;
  return row ?? event.currentTarget;
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

/**
 * Opens a row's menu from the Menu key or Shift F10, below the row that has
 * focus. A key typed in a field, during composition, or with another modifier
 * is left alone. The press stops here, so no menu above this row opens too.
 *
 * @returns Whether the press opened the menu.
 */
export function openMenuFromKey(
  event: KeyboardEvent<HTMLElement>,
  open: (anchor: MenuAnchor) => void,
): boolean {
  if (!isContextMenuKey(event)) return false;
  event.preventDefault();
  event.stopPropagation();
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
