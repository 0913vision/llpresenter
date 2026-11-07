import {useEffect, useRef, type PointerEvent} from 'react';
import {isCommandDragActive, setCommandDragActive} from './commandDrag';
import styles from './ResizeGap.module.css';

export interface ResizeSession {
  move(delta: number): void;
  end(): void;
}

/** A captured pointer drag shared by horizontal and vertical panel borders. */
export function ResizeGap({
  axis,
  name,
  begin,
  disabled = false,
}: {
  readonly axis: 'row' | 'column';
  readonly name: string;
  readonly begin: () => ResizeSession | undefined;
  readonly disabled?: boolean;
}) {
  const active = useRef<{
    session: ResizeSession;
    pointerId: number;
    start: number;
  } | null>(null);
  useEffect(
    () => () => {
      const current = active.current;
      if (current === null) return;
      active.current = null;
      try {
        current.session.end();
      } finally {
        setCommandDragActive(false);
      }
    },
    [],
  );
  const coordinate = (event: PointerEvent<HTMLDivElement>) =>
    axis === 'row' ? event.clientY : event.clientX;
  const finish = (event: PointerEvent<HTMLDivElement>): void => {
    const current = active.current;
    if (current?.pointerId !== event.pointerId) return;
    active.current = null;
    setCommandDragActive(false);
    current.session.end();
  };
  return (
    <div
      className={`${styles.gap} ${axis === 'row' ? styles.row : styles.column}`}
      data-gap={axis === 'column' ? name : undefined}
      data-row-gap={axis === 'row' ? name : undefined}
      data-disabled={disabled || undefined}
      onPointerDown={event => {
        if (
          disabled ||
          event.button !== 0 ||
          active.current ||
          isCommandDragActive()
        ) {
          return;
        }
        const session = begin();
        if (!session) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setCommandDragActive(true);
        active.current = {
          session,
          pointerId: event.pointerId,
          start: coordinate(event),
        };
      }}
      onPointerMove={event => {
        const current = active.current;
        if (current?.pointerId === event.pointerId) {
          current.session.move(coordinate(event) - current.start);
        }
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    />
  );
}
