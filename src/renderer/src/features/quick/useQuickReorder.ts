import type {RefObject} from 'react';
import type {QuickItem} from '@core/schema/quick';
import {useRowMoveKeys} from '@renderer/ui/reorder';
import type {QuickEdit} from './quickEdits';
import {useQuickDrag} from './useQuickDrag';

function quickIdOf(target: EventTarget | null): string | null {
  return target instanceof Element
    ? (target.closest<HTMLElement>('[data-quick-id]')?.dataset['quickId'] ??
        null)
    : null;
}

/** Moves 빠른 실행 items by dragging them or with the move keys. */
export function useQuickReorder({
  list,
  items,
  ids,
  revision,
  locked,
  save,
}: {
  readonly list: RefObject<HTMLDivElement | null>;
  readonly items: readonly QuickItem[];
  readonly ids: readonly string[];
  readonly revision: number | null;
  readonly locked: boolean;
  readonly save: (edit: QuickEdit) => Promise<boolean>;
}) {
  const move = (id: string, before: string | null): void => {
    const source = items.find(item => item.id === id);
    const target = items.find(item => item.id === before);
    if (!source || (before !== null && !target)) return;
    save({kind: 'move', id: source.id, before: target?.id ?? null}).catch(
      (cause: unknown) =>
        console.error('Quick reorder callback failed:', cause),
    );
  };
  const drag = useQuickDrag({
    enabled: !locked,
    revision,
    ids,
    listRef: list,
    onMove: move,
  });
  useRowMoveKeys({
    owns: event =>
      event.target instanceof Node &&
      list.current?.contains(event.target) === true,
    rowId: quickIdOf,
    ids,
    enabled: !locked,
    onMove: move,
  });
  return drag;
}
