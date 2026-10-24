import {useRef, type JSX, type PointerEvent} from 'react';
import type {DragSession} from './ColumnLayout';
import type {DraggableColumn} from './columns';
import styles from './ColumnGap.module.css';

/** What a gap needs from the column layout to start a drag. */
export interface ColumnDrag {
  begin(column: DraggableColumn): DragSession | undefined;
}

const PRIMARY_BUTTON = 0;

interface ActiveDrag {
  readonly session: DragSession;
  readonly pointerId: number;
  readonly startX: number;
}

/** The gap between two columns. Dragging it resizes the column beside it. */
export function ColumnGap({
  column,
  drag,
}: {
  readonly column: DraggableColumn;
  readonly drag: ColumnDrag;
}): JSX.Element {
  const active = useRef<ActiveDrag | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== PRIMARY_BUTTON || active.current) return;
    const session = drag.begin(column);
    if (!session) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = {
      session,
      pointerId: event.pointerId,
      startX: event.clientX,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = active.current;
    if (current?.pointerId !== event.pointerId) return;
    current.session.move(event.clientX - current.startX);
  };
  const finish = (event: PointerEvent<HTMLDivElement>): void => {
    const current = active.current;
    if (current?.pointerId !== event.pointerId) return;
    active.current = null;
    current.session.end();
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
