import type {RefObject} from 'react';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  NOTHING_TO_UNDO,
  NOTHING_TO_REDO,
} from '@renderer/platform/problemReasons';
import {isInTextEntry} from '@renderer/ui/textEntry';

/** Share the edit-menu dispatcher with the focused tool's deletion history. */
export function useToolDeleteShortcuts(
  root: RefObject<HTMLElement | null>,
  editing: {
    readonly history: {
      readonly undo: number;
      readonly redo: number;
      readonly busy: boolean;
    };
    readonly replay: (kind: 'undo' | 'redo') => Promise<boolean>;
  },
): void {
  useWindowShortcuts(
    (['undo', 'redo'] as const).map(kind => ({
      id: `edit.${kind}`,
      context: 'service',
      when: (event: KeyboardEvent) =>
        event.target instanceof Node &&
        root.current?.contains(event.target) === true &&
        !isInTextEntry(event.target),
      unavailable: () =>
        !editing.history.busy && editing.history[kind] > 0
          ? undefined
          : kind === 'undo'
            ? NOTHING_TO_UNDO
            : NOTHING_TO_REDO,
      run: () => editing.replay(kind),
    })),
  );
}
