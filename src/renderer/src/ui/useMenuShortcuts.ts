import {useCommandShortcuts, type WindowShortcut} from './commandDispatcher';
import type {MenuEntry} from './menuModel';

function handlers(entries: readonly MenuEntry[]): readonly WindowShortcut[] {
  return entries.flatMap(entry => {
    if (entry.kind !== 'item') return [];
    const own: readonly WindowShortcut[] =
      entry.command === undefined || entry.onSelect === undefined
        ? []
        : [
            {
              id: entry.command,
              when: () => entry.disabled !== true,
              run: entry.onSelect,
            },
          ];
    return entry.submenu === undefined
      ? own
      : [...own, ...handlers(entry.submenu)];
  });
}

/** Eager menu actions share their callbacks; deferred submenus stay deferred. */
export function useMenuShortcuts(entries: readonly MenuEntry[]): void {
  useCommandShortcuts(handlers(entries));
}
