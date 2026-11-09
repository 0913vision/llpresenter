import type {MenuEntry, MenuItem} from './menuModel';

const GROUPS = [
  'default',
  'settings',
  'memo',
  'clipboard',
  'library',
  'hide',
  'delete',
] as const;
const CLIPBOARD = [
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'copy-style',
  'paste-style',
  'duplicate',
];

function available(entries: readonly MenuEntry[]): readonly MenuEntry[] {
  const result: MenuEntry[] = [];
  let divider: MenuEntry | undefined;
  for (const entry of entries) {
    if (entry.kind !== 'item') {
      divider = entry;
      continue;
    }
    const submenu =
      entry.submenu === undefined ? undefined : available(entry.submenu);
    if (submenu?.length === 0 && !entry.unimplemented) continue;
    if (
      divider !== undefined &&
      (result.length > 0 || divider.kind === 'group')
    ) {
      result.push(divider);
    }
    divider = undefined;
    result.push({
      ...entry,
      submenu,
      ...(entry.loadSubmenu === undefined
        ? {}
        : {loadSubmenu: () => available(entry.loadSubmenu?.() ?? [])}),
    });
  }
  return result;
}

/** Groups object commands, retaining disabled future rows and useful separators. */
export function contextMenuEntries(
  entries: readonly MenuEntry[],
): readonly MenuEntry[] {
  const items = available(entries).filter(
    (entry): entry is MenuItem => entry.kind === 'item',
  );
  const result: MenuEntry[] = [];
  for (const group of GROUPS) {
    const values = items.filter(
      item => (item.contextGroup ?? 'settings') === group,
    );
    if (group === 'clipboard') {
      const rank = (id: string): number =>
        CLIPBOARD.includes(id) ? CLIPBOARD.indexOf(id) : CLIPBOARD.length;
      values.sort((a, b) => rank(a.id) - rank(b.id));
    }
    if (group === 'library') {
      const order = [
        'show-in-library',
        'save-to-library',
        'reload-from-library',
      ];
      const rank = (id: string): number =>
        order.includes(id) ? order.indexOf(id) : order.length;
      values.sort((a, b) => rank(a.id) - rank(b.id));
    }
    if (values.length === 0) continue;
    if (result.length > 0) {
      result.push({kind: 'separator', id: `context:${group}`});
    }
    result.push(...values);
  }
  return result;
}
