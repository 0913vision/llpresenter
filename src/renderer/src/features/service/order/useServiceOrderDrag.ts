import {orderedSelection} from '@core/common/selectionOrder';
import {selectionDragImage} from '@renderer/ui/selectionDrag';
import {useEffect, useRef, useState, type DragEvent} from 'react';
import type {SongId} from '@core/schema/ids';
import {readSongDragData, SONG_DRAG_MIME} from '@core/schema/songDrag';
import type {ServiceRow} from '@core/presentation/model';
import {sectionBoundaryIndex} from '@core/services/serviceSections';
import {beforeRowMidpoint} from '@renderer/ui/rowDrag';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';

interface DragOptions {
  readonly enabled: boolean;
  readonly rows: readonly ServiceRow[];
  readonly onMove: (source: readonly string[], before: string | null) => void;
  readonly selected: ReadonlySet<string>;
  readonly select: (id: string) => void;
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
  selected,
  select,
  onCopy,
}: DragOptions) {
  const dragged = useRef<string | null>(null);
  const sourceRows = useRef<readonly ServiceRow[] | null>(null);
  const moving = useRef<readonly string[]>([]);
  const release = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => release.current?.(), []);
  const click = useDragClickGuard();
  const [insertBefore, setInsertBefore] = useState<string | null | undefined>();
  const accepts = (event: DragEvent): boolean =>
    enabled &&
    ((dragged.current !== null && sourceRows.current === rows) ||
      event.dataTransfer.types.includes(SONG_DRAG_MIME));
  const destination = (event: DragEvent): string | null => {
    let element = rowElement(event.target);
    if (element === null) {
      const first =
        event.currentTarget.querySelector<HTMLElement>('[data-order-id]');
      const face =
        first?.querySelector('[role="option"]') ??
        first?.querySelector('[role="group"] > div');
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
    const label =
      element.querySelector('[role="option"]') ??
      element.querySelector('[role="group"]')?.firstElementChild;
    const rect = (label ?? element).getBoundingClientRect();
    const after = rect.height > 0 && !beforeRowMidpoint(event.clientY, rect);
    const targetIndex = rows.findIndex(row => row.id === id);
    if (targetIndex < 0) return id;
    const requested = targetIndex + (after ? 1 : 0);
    let index = requested;
    if (
      rows.some(row => moving.current.includes(row.id) && row.kind === 'header')
    ) {
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
  const clear = (): void => {
    release.current?.();
    moving.current = [];
    dragged.current = null;
    setInsertBefore(undefined);
  };
  return {
    insertBefore,
    dragProps: {
      onPointerDownCapture: click.props.onPointerDownCapture,
      onClickCapture: click.props.onClickCapture,
      onDoubleClickCapture: click.props.onDoubleClickCapture,
      onDragStart: (event: DragEvent<HTMLElement>): void => {
        if (!enabled) {
          event.preventDefault();
          return;
        }
        const id = serviceOrderRowId(event.target);
        if (id === null) {
          event.preventDefault();
          return;
        }
        if (!selected.has(id)) select(id);
        moving.current = orderedSelection(
          rows,
          selected.has(id) ? selected : new Set([id]),
          row => row.kind === 'header',
        ).map(row => row.id);
        dragged.current = id;
        sourceRows.current = rows;
        release.current?.();
        release.current = selectionDragImage(
          event.dataTransfer,
          rowElement(event.target) ?? event.currentTarget,
          moving.current.length,
        );
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        click.markDragged();
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
        const source = dragged.current === null ? null : moving.current;
        clear();
        if (source !== null) {
          onMove(source, before);
          return;
        }
        const payload = readSongDragData(
          event.dataTransfer.getData(SONG_DRAG_MIME),
        );
        if (!payload.ok) return;
        onCopy(payload.value.songId, before);
      },
    },
  };
}
