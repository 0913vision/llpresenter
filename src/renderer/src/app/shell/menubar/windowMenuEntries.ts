import type {MenuEntry} from '@renderer/ui/menus/menuModel';

/** The 창 menu (spec 11): the title bar buttons. */
export function windowMenuEntries(): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'minimize',
      label: '최소화',
      command: 'window.minimize',
      onSelect: () => window.llp?.window.control('minimize'),
    },
    {
      kind: 'item',
      id: 'maximize',
      label: '최대화',
      command: 'window.maximize',
      onSelect: () => window.llp?.window.control('toggle-maximize'),
    },
  ];
}
