import type {KeyboardEvent, MouseEvent} from 'react';
import type {MenuAnchor} from '@renderer/ui/Menu';

export type ContextMenuEvent =
  MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

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
  if ('clientX' in event && (event.clientX !== 0 || event.clientY !== 0)) {
    return {kind: 'point', point: {x: event.clientX, y: event.clientY}};
  }
  const row =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-value]')
      : null;
  return {kind: 'element', element: row ?? event.currentTarget};
}
