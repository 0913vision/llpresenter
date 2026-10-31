import {expect, it, vi} from 'vitest';
import {settingsDocument} from '@core/testing/screenDocuments';
import {menuItems} from '@renderer/ui/menuModel';
import {macroMenuEntries, type MacroMenuHandlers} from './macroMenuEntries';

it('defers large target lists until the chosen action or kind opens', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const document = settingsDocument('macros', {
    macros: [
      {
        id,
        name: '예배',
        color: 'teal',
        icon: 'macro',
        actions: Array.from({length: 256}, () => ({kind: 'media', media: id})),
      },
    ],
    collections: [],
  });
  if (document.name !== 'macros') throw new Error('Invalid fixture');
  const item = document.value.macros[0];
  if (!item) throw new Error('Missing macro');
  let namesRead = 0;
  const targets = Array.from({length: 10_000}, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    get name() {
      namesRead++;
      return `미디어 ${index + 1}`;
    },
  }));
  const chooseAction = vi.fn<MacroMenuHandlers['chooseAction']>();
  const noop = () => undefined;
  const handlers: MacroMenuHandlers = {
    rename: noop,
    changeIcon: noop,
    changeColor: noop,
    toggleStartup: noop,
    addTo: noop,
    moveTo: noop,
    newCollection: noop,
    addAction: noop,
    chooseAction,
    openAction: noop,
    removeAllActions: noop,
    openPalette: noop,
    removeAction: noop,
    duplicate: noop,
    remove: noop,
  };
  const rows = menuItems(
    macroMenuEntries(
      {
        item,
        collections: [],
        shown: undefined,
        macroCount: 1,
        locked: false,
        targets: {media: targets},
      },
      handlers,
    ),
  );
  const edits = rows.filter(row => row.id.startsWith('edit-'));
  expect(edits).toHaveLength(256);
  expect(namesRead).toBeLessThan(1000);
  const choices = menuItems(edits[0]?.loadSubmenu?.() ?? []);
  expect(choices).toHaveLength(10_001);
  expect(namesRead).toBeLessThan(11_000);
  choices[1]?.onSelect?.();
  expect(chooseAction).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({kind: 'media', target: targets[1]?.id}),
    0,
  );
  const add = rows.find(row => row.id === 'add-action');
  const media = menuItems(add?.submenu ?? []).find(row => row.id === 'media');
  expect(menuItems(media?.loadSubmenu?.() ?? [])).toHaveLength(10_000);
  expect(namesRead).toBeLessThan(21_000);
});
