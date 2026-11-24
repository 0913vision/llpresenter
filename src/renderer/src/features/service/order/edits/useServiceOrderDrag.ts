import {ELEMENT_DRAG_MIME, isPaletteKey} from '../../items/newItems';
import {hasMediaDrag, readMediaDrag} from '@renderer/features/media/mediaDrag';
import type {MediaId, SongId} from '@core/schema/common/ids';
import {
  isUnchangedSelectionMove,
  orderedSelection,
} from '@core/common/selectionOrder';
import {selectionDragImage} from '@renderer/ui/lists/selectionDrag';
import {useEffect, useRef, useState, type DragEvent} from 'react';
import {readSongDragData, SONG_DRAG_MIME} from '@core/schema/songs/songDrag';
import type {ServiceRow} from '@core/presentation';
import {quickAddBefore, sectionBoundaryIndex} from '@core/services';
import {useShow} from '@renderer/session/showStore';
import {beforeRowMidpoint} from '@renderer/ui/lists/rowDrag';
import {useDragClickGuard} from '@renderer/ui/lists/useDragClickGuard';

interface DragOptions {
  readonly enabled: boolean;
  readonly allowReorder: boolean;
  readonly rows: readonly ServiceRow[];
  readonly onMove: (source: readonly string[], before: string | null) => void;
  readonly selected: ReadonlySet<string>;
  readonly select: (id: string) => void;
  readonly onCopy: (songId: SongId, before: string | null) => void;
  readonly onElement?:
    ((key: string, before: string | null) => void) | undefined;
  readonly onMedia?: ((id: MediaId, before: string | null) => void) | undefined;
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
  allowReorder,
  rows,
  onMove,
  selected,
  select,
  onCopy,
  onElement,
  onMedia,
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
      event.dataTransfer.types.includes(SONG_DRAG_MIME) ||
      (onElement !== undefined &&
        event.dataTransfer.types.includes(ELEMENT_DRAG_MIME)) ||
      (onMedia !== undefined && hasMediaDrag(event.dataTransfer)));
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
  const unchanged = (before: string | null): boolean => {
    const index =
      before === null ? rows.length : rows.findIndex(row => row.id === before);
    return (
      index >= 0 &&
      isUnchangedSelectionMove(
        rows.map(row => row.id),
        new Set(moving.current),
        index,
      )
    );
  };
  const clear = (): void => {
    release.current?.();
    moving.current = [];
    dragged.current = null;
    setInsertBefore(undefined);
  };
  const dropBefore = (event: DragEvent): string | null =>
    dragged.current === null && rowElement(event.target) === null
      ? quickAddBefore(rows, useShow.getState().openItemId)
      : destination(event);
  return {
    insertBefore,
    dragProps: {
      onPointerDownCapture: click.props.onPointerDownCapture,
      onClickCapture: click.props.onClickCapture,
      onDoubleClickCapture: click.props.onDoubleClickCapture,
      onDragStart: (event: DragEvent<HTMLElement>): void => {
        if (!enabled || !allowReorder) {
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
        const before = dropBefore(event);
        setInsertBefore(
          dragged.current !== null && unchanged(before) ? undefined : before,
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
        const before = dropBefore(event);
        const source = dragged.current === null ? null : moving.current;
        const noChange = source !== null && unchanged(before);
        clear();
        if (noChange) return;
        if (source !== null) {
          onMove(source, before);
          return;
        }
        if (onMedia && hasMediaDrag(event.dataTransfer)) {
          const media = readMediaDrag(event.dataTransfer);
          if (media !== undefined) onMedia(media, before);
          return;
        }
        if (onElement && event.dataTransfer.types.includes(ELEMENT_DRAG_MIME)) {
          const key = event.dataTransfer.getData(ELEMENT_DRAG_MIME);
          if (isPaletteKey(key)) onElement(key, before);
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
