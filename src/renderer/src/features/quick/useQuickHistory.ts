import {useState, type RefObject} from 'react';
import type {QuickItem} from '@core/schema/quick';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import type {QuickEdit} from './quickEdits';

interface Step {
  readonly item: QuickItem;
  readonly before: QuickItem['id'] | null;
}

/**
 * Deleting 빠른 실행 rows with 실행 취소 and 다시 실행: a deleted row comes
 * back where it was. Any other edit forgets the steps forward.
 */
export function useQuickHistory({
  items,
  locked,
  run,
  list,
}: {
  readonly items: readonly QuickItem[];
  readonly locked: boolean;
  readonly run: (edit: QuickEdit) => Promise<boolean>;
  /** The list; the edit keys work while the focus is in it. */
  readonly list: RefObject<HTMLElement | null>;
}) {
  const [history, setHistory] = useState<{
    readonly undo: readonly Step[];
    readonly redo: readonly Step[];
  }>({undo: [], redo: []});
  const replay = (kind: 'undo' | 'redo'): void => {
    const step = (kind === 'undo' ? history.undo : history.redo).at(-1);
    if (!step || locked) return;
    const edit: QuickEdit =
      kind === 'undo'
        ? {kind: 'restore', item: step.item, before: step.before}
        : {kind: 'delete', id: step.item.id};
    run(edit)
      .then(saved => {
        if (saved) {
          setHistory(old =>
            kind === 'undo'
              ? {undo: old.undo.slice(0, -1), redo: [...old.redo, step]}
              : {undo: [...old.undo, step], redo: old.redo.slice(0, -1)},
          );
        }
      })
      .catch((cause: unknown) =>
        console.error('Quick history callback failed:', cause),
      );
  };
  useWindowShortcuts(
    (['undo', 'redo'] satisfies Array<'undo' | 'redo'>).map(kind => ({
      id: `edit.${kind}`,
      when: (event: KeyboardEvent) =>
        event.target instanceof Node &&
        list.current?.contains(event.target) === true,
      unavailable: () =>
        !locked &&
        (kind === 'undo' ? history.undo.length > 0 : history.redo.length > 0)
          ? undefined
          : kind === 'undo'
            ? NOTHING_TO_UNDO
            : NOTHING_TO_REDO,
      run: () => replay(kind),
    })),
  );
  return {
    /** Forgets the steps forward, after an edit of another kind. */
    clearRedo: (): void => setHistory(old => ({...old, redo: []})),
    /** Asks to delete `item`, then deletes it with a step back. */
    remove: (item: QuickItem): void => {
      const index = items.findIndex(value => value.id === item.id);
      deleteSelection(
        1,
        () => !locked && index >= 0,
        () => {
          const before = items[index + 1]?.id ?? null;
          const element = list.current;
          if (element) {
            element.tabIndex = -1;
            element.focus({preventScroll: true});
            element.removeAttribute('tabindex');
          }
          run({kind: 'delete', id: item.id})
            .then(saved => {
              if (saved) {
                setHistory(old => ({
                  undo: [...old.undo, {item, before}],
                  redo: [],
                }));
              }
            })
            .catch((cause: unknown) =>
              console.error('Quick delete callback failed:', cause),
            );
        },
      );
    },
  };
}
