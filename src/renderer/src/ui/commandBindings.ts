import {useSyncExternalStore} from 'react';
import type {ShortcutsFile} from '@core/schema/shortcuts';
import {commandBindings, shortcutConflicts} from '@core/shortcuts/bindings';
import {shortcutNames} from '@core/shortcuts/keys';

let bindings: ShortcutsFile['bindings'] = {};
let conflicts = shortcutConflicts(bindings);
const listeners = new Set<() => void>();

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

export function shortcutText(id: string | undefined): string | undefined {
  if (id === undefined) return undefined;
  const first = commandBindings(id, bindings)[0];
  return first === undefined ? undefined : shortcutNames(first).join(' ');
}

export function useShortcutText(id: string | undefined): string | undefined {
  useSyncExternalStore(commandBindingStore.subscribe, commandBindingStore.get);
  return shortcutText(id);
}
