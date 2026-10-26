import {useRef, useState, type DragEvent} from 'react';
import type {SongId} from '@shared/schema/ids';
import {readSongDragData, SONG_DRAG_MIME} from '@shared/schema/songDrag';
import type {ServiceRow} from './model';
import {sectionBoundaryIndex} from './serviceSections';
import {beforeRowMidpoint} from '@renderer/ui/rowDrag';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';

interface DragOptions {
  readonly enabled: boolean;
  readonly rows: readonly ServiceRow[];
  readonly onMove: (source: string, before: string | null) => void;
  readonly onCopy: (songId: SongId, before: string | null) => void;
  readonly onFill: (songId: SongId, slotId: string) => void;
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
  onFill,
}: DragOptions) {
  const dragged = useRef<string | null>(null);
  const click = useDragClickGuard();
  const [insertBefore, setInsertBefore] = useState<string | null | undefined>();
  const accepts = (event: DragEvent): boolean =>
    enabled &&
    (dragged.current !== null ||
      event.dataTransfer.types.includes(SONG_DRAG_MIME));
  const destination = (event: DragEvent): string | null => {
    let element = rowElement(event.target);
    if (element === null) {
      const first =
        event.currentTarget.querySelector<HTMLElement>('[data-order-id]');
      const face = first?.querySelector(
        '[role="option"], [role="group"] > div',
      );
      if (
        first &&
        face &&
        beforeRowMidpoint(event.clientY, face.getBoundingClientRect())
      ) {
        element = first;
      }
    }
    const id = element?.dataset['orderId'];
    if (element === null || id === undefined) return null;
    const label = element.querySelector('[role="group"]')?.firstElementChild;
    const rect = (label ?? element).getBoundingClientRect();
    const after = rect.height > 0 && !beforeRowMidpoint(event.clientY, rect);
    const targetIndex = rows.findIndex(row => row.id === id);
    if (targetIndex < 0) return id;
    const requested = targetIndex + (after ? 1 : 0);
    let index = requested;
    if (rows.find(row => row.id === dragged.current)?.kind === 'header') {
      index = sectionBoundaryIndex(
        rows,
        requested,
        row => row.kind === 'header',
      );
      if (after && index < requested) {
        const next = rows.findIndex(
          (row, position) => position >= requested && row.kind === 'header',
        );
        index = next < 0 ? rows.length : next;
      }
    }
    return rows[index]?.id ?? null;
  };
  const songSlotUnder = (event: DragEvent): string | null => {
    if (dragged.current !== null) return null;
    const id = rowElement(event.target)?.dataset['orderId'];
    const row = rows.find(item => item.id === id);
    return row?.kind === 'slot' && row.accepts === 'song' ? row.id : null;
  };
  const clear = (): void => {
    dragged.current = null;
    setInsertBefore(undefined);
  };
  return {
    insertBefore,
    dragProps: {
      onPointerDownCapture: click.props.onPointerDownCapture,
      onClickCapture: click.props.onClickCapture,
      onDoubleClickCapture: click.props.onDoubleClickCapture,
      onDragStart: (event: DragEvent): void => {
        if (!enabled) {
          event.preventDefault();
          return;
        }
        dragged.current = serviceOrderRowId(event.target);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', dragged.current ?? '');
        click.markDragged();
      },
      onDragEnd: clear,
      onDragOver: (event: DragEvent): void => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect =
          dragged.current === null ? 'copy' : 'move';
        setInsertBefore(
          songSlotUnder(event) === null ? destination(event) : undefined,
        );
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
        const slotId = songSlotUnder(event);
        const source = dragged.current;
        clear();
        if (source !== null) {
          onMove(source, before);
          return;
        }
        const payload = readSongDragData(
          event.dataTransfer.getData(SONG_DRAG_MIME),
        );
        if (!payload.ok) return;
        if (slotId === null) onCopy(payload.value.songId, before);
        else onFill(payload.value.songId, slotId);
      },
    },
  };
}
