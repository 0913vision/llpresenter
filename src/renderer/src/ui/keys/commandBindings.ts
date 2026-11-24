import {useSyncExternalStore} from 'react';
import type {ShortcutsFile} from '@core/schema/app/shortcuts';
import {
  commandBindings,
  shortcutConflicts,
  shortcutNames,
} from '@core/shortcuts';

let bindings: ShortcutsFile['bindings'] = {};
let conflicts = shortcutConflicts(bindings);
const listeners = new Set<() => void>();

/**
 * The operator's shortcut bindings in this window and their conflicts, as a
 * store React can follow.
 */
export const commandBindingStore = {
  get: () => bindings,
  conflicts: () => conflicts,
  set: (next: ShortcutsFile['bindings']): void => {
    bindings = next;
    conflicts = shortcutConflicts(next);
    for (const listener of listeners) listener();
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * The first shortcut of a command in words, as menus and tooltips show it;
 * `undefined` when it has none.
 */
export function shortcutText(id: string | undefined): string | undefined {
  if (id === undefined) return undefined;
  const first = commandBindings(id, bindings)[0];
  return first === undefined ? undefined : shortcutNames(first).join(' ');
}

/** {@link shortcutText}, read again whenever the bindings change. */
export function useShortcutText(id: string | undefined): string | undefined {
  useSyncExternalStore(commandBindingStore.subscribe, commandBindingStore.get);
  return shortcutText(id);
}
