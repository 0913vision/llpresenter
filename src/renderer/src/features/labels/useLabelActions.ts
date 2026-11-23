import {useRef} from 'react';
import {freeName} from '@core/common/freeName';
import type {Label} from '@core/schema/labels';
import type {LabelCatalog} from './labelCatalog';

const NEW_LABEL_NAME = '새 이름표';

/**
 * The edits of the 이름표 list. Each one first saves the names being typed
 * (their drafts), runs one at a time, and reads the stored labels when it
 * runs, not when it was asked.
 */
export function useLabelActions(store: LabelCatalog) {
  const drafts = useRef(new Map<number, () => Promise<boolean>>());
  const acting = useRef(false);
  const current = (): readonly Label[] => store.getStoredLabels();
  const settle = async (): Promise<boolean> => {
    for (const save of [...drafts.current.values()]) {
      if (!(await save())) return false;
    }
    return true;
  };
  const run = async <T>(
    action: () => T | Promise<T>,
  ): Promise<T | undefined> => {
    if (acting.current) return undefined;
    acting.current = true;
    try {
      if (!(await settle())) return undefined;
      return await action();
    } finally {
      acting.current = false;
    }
  };
  return {
    current,
    settle,
    run,
    /** Keeps the save of the name typed in row `key`; null drops it. */
    draft: (key: number, save: (() => Promise<boolean>) | null): void => {
      if (save === null) drafts.current.delete(key);
      else drafts.current.set(key, save);
    },
    /** Adds a 새 이름표 with a free name; resolves that name, or null. */
    create: async (): Promise<string | null> => {
      const state = store.getSnapshot();
      if (state.busy || state.labels?.access !== 'editable') return null;
      const labels = current();
      const name = freeName(
        NEW_LABEL_NAME,
        new Set(labels.map(label => label.name)),
      );
      return (await store.updateLabels([...labels, {name, color: 'none'}]))
        ? name
        : null;
    },
    /** Moves the label `name` to `target`, its place after the move. */
    move: (name: string, target: number): Promise<unknown> => {
      // NOTE(0913vision): The place is read before the drafts save, since
      // saving a typed name can rename the label being moved.
      const source = current().findIndex(label => label.name === name);
      return run(async () => {
        const labels = [...current()];
        if (
          source < 0 ||
          source === target ||
          target < 0 ||
          target >= labels.length
        ) {
          return;
        }
        const [label] = labels.splice(source, 1);
        if (label === undefined) return;
        labels.splice(target, 0, label);
        await store.updateLabels(labels);
      });
    },
    /** Gives the label `name` the color `color`; false when it is gone. */
    recolor: async (name: string, color: Label['color']): Promise<boolean> =>
      (await run(() => {
        const labels = current();
        if (!labels.some(item => item.name === name)) return false;
        return store.updateLabels(
          labels.map(item => (item.name === name ? {...item, color} : item)),
        );
      })) === true,
  };
}
