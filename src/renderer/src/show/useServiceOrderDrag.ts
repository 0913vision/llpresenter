import {useRef, useState, type DragEvent} from 'react';
import type {SongId} from '@shared/schema/ids';
import {readSongDragData, SONG_DRAG_MIME} from '@shared/schema/songDrag';

interface DragOptions {
  readonly enabled: boolean;
  readonly rows: ReadonlyArray<{readonly id: string}>;
  readonly onMove: (source: string, before: string | null) => void;
  readonly onCopy: (songId: SongId, before: string | null) => void;
}

function rowElement(target: EventTarget): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>('[data-order-id]')
    : null;
}

export function serviceOrderRowId(target: EventTarget): string | null {
  return rowElement(target)?.dataset['orderId'] ?? null;
}

/** Shares native drop handling and the design-system insertion line. */
export function useServiceOrderDrag({
  enabled,
  rows,
  onMove,
  onCopy,
}: DragOptions) {
  const dragged = useRef<string | null>(null);
  const [insertBefore, setInsertBefore] = useState<string | null | undefined>();
  const accepts = (event: DragEvent): boolean =>
    enabled &&
    (dragged.current !== null ||
      event.dataTransfer.types.includes(SONG_DRAG_MIME));
  const destination = (event: DragEvent): string | null => {
    const element = rowElement(event.target);
    const id = element?.dataset['orderId'];
    if (element === null || id === undefined) return null;
    const label = element.querySelector('[role="group"]')?.firstElementChild;
    const rect = (label ?? element).getBoundingClientRect();
    if (rect.height > 0 && event.clientY >= rect.top + rect.height / 2) {
      return rows[rows.findIndex(row => row.id === id) + 1]?.id ?? null;
    }
    return id;
  };
  const clear = (): void => {
    dragged.current = null;
    setInsertBefore(undefined);
  };
  return {
    insertBefore,
    dragProps: {
      onDragStart: (event: DragEvent): void => {
        if (!enabled) {
          event.preventDefault();
          return;
        }
        dragged.current = serviceOrderRowId(event.target);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', dragged.current ?? '');
      },
      onDragEnd: clear,
      onDragOver: (event: DragEvent): void => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect =
          dragged.current === null ? 'copy' : 'move';
        setInsertBefore(destination(event));
      },
      onDragLeave: (event: DragEvent): void => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setInsertBefore(undefined);
        }
      },
      onDrop: (event: DragEvent): void => {
        if (!accepts(event)) return;
        event.preventDefault();
        const before = destination(event);
        const source = dragged.current;
        clear();
        if (source !== null) {
          onMove(source, before);
          return;
        }
        const payload = readSongDragData(
          event.dataTransfer.getData(SONG_DRAG_MIME),
        );
        if (payload.ok) onCopy(payload.value.songId, before);
      },
    },
  };
}
