import {useRef, type JSX, type PointerEvent} from 'react';
import type {DraggableColumn} from './columns';
import styles from './ColumnGap.module.css';

/** What a gap needs from the column layout while the pointer drags it. */
export interface ColumnDrag {
  begin(column: DraggableColumn): void;
  move(delta: number): void;
  end(): void;
}

const PRIMARY_BUTTON = 0;

/** The gap between two columns. Dragging it resizes the column beside it. */
export function ColumnGap({
  column,
  drag,
}: {
  readonly column: DraggableColumn;
  readonly drag: ColumnDrag;
}): JSX.Element {
  const startX = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== PRIMARY_BUTTON) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startX.current = event.clientX;
    drag.begin(column);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (startX.current === null) return;
    drag.move(event.clientX - startX.current);
  };
  const finish = (): void => {
    if (startX.current === null) return;
    startX.current = null;
    drag.end();
  };

  return (
    <div
      className={styles.gap}
      data-gap={column}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    />
  );
}
