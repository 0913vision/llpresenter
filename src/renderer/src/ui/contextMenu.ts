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

export function isContextMenuKey(event: KeyboardEvent<HTMLElement>): boolean {
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
