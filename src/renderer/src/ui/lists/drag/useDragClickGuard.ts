import {useRef, type DragEvent, type MouseEvent} from 'react';

/**
 * Stops the click that ends a drag, so dropping a row does not also choose it.
 * Spread `props` on the draggable element.
 */
export function useDragClickGuard() {
  const dragged = useRef(false);
  const capture = (event: MouseEvent): void => {
    const native = event.nativeEvent;
    const pointer =
      event.detail > 0 ||
      ('pointerType' in native &&
        typeof native.pointerType === 'string' &&
        native.pointerType !== '');
    if (!dragged.current || !pointer) return;
    event.preventDefault();
    event.stopPropagation();
  };
  return {
    markDragged: () => {
      dragged.current = true;
    },
    wasDragged: () => dragged.current,
    props: {
      onPointerDownCapture: () => {
        dragged.current = false;
      },
      onDragStart: (event: DragEvent) => {
        if (!event.defaultPrevented) dragged.current = true;
      },
      onClickCapture: capture,
      onDoubleClickCapture: capture,
    },
  };
}
