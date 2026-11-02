import {settingsDocument} from '@fixtures/core/settingsDocument';
import {expect, it, vi} from 'vitest';
import {hasSubmenu, menuItems} from '@renderer/ui/menuModel';
import {macroActionEntries} from '@renderer/features/tools/macroActionMenuEntries';
import type {MacroMenuHandlers} from '@renderer/features/tools/macroMenuEntries';
import {mockHandlers} from '@fixtures/renderer/features/tools/macroMenuTesting';

it('offers theme targets and marks an action of an unknown kind as unsupported', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const doc = settingsDocument('macros', {
    macros: [
      {
        id: '00000000-0000-4000-8000-000000000020',
        name: '예배 시작',
        color: 'teal',
        icon: 'macro',
        actions: [
          {kind: 'camera', input: 2},
          {kind: 'clearLayer', layer: 'slide'},
        ],
      },
    ],
    collections: [],
  });
  if (doc.name !== 'macros') throw new Error('Invalid fixture');
  const item = doc.value.macros[0];
  if (!item) throw new Error('Missing macro fixture');
  const handlers = mockHandlers();
  const rows = menuItems(
    macroActionEntries(
      {
        item,
        locked: false,
        targets: {theme: [{id, name: 'Theme'}]},
      },
      handlers,
    ),
  );
  expect(rows.find(row => row.id === 'edit-0')).toMatchObject({
    label: '동작 편집: 알 수 없는 동작',
    disabled: true,
    title: '이번 버전에서는 쓸 수 없는 동작',
    loadSubmenu: undefined,
  });
  const remove = menuItems(
    rows.find(row => row.id === 'remove-actions')?.submenu ?? [],
  ).find(row => row.id === 'remove-0');
  expect(remove?.label).toBe('알 수 없는 동작');
  expect(remove?.disabled).not.toBe(true);
  remove?.onSelect?.();
  expect(handlers.removeAction).toHaveBeenCalledExactlyOnceWith(0);
  const add = menuItems(
    rows.find(row => row.id === 'add-action')?.submenu ?? [],
  );
  menuItems(
    add.find(row => row.id === 'theme')?.loadSubmenu?.() ?? [],
  )[0]?.onSelect?.();
  expect(handlers.chooseAction).toHaveBeenCalledWith(
    expect.objectContaining({kind: 'theme', target: id}),
  );
});

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
  const handlers: MacroMenuHandlers = {
    ...mockHandlers(),
    chooseAction,
  };
  const rows = menuItems(
    macroActionEntries(
      {
        item,
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
  const placeholders = menuItems(add?.submenu ?? []).filter(row =>
    [
      'slide-destination',
      'communication',
      'audio-input',
      'video-input',
      'capture',
    ].includes(row.id),
  );
  expect(placeholders).toHaveLength(5);
  for (const placeholder of placeholders) {
    expect(placeholder.disabled).toBe(true);
    expect(hasSubmenu(placeholder)).toBe(true);
  }
  const media = menuItems(add?.submenu ?? []).find(row => row.id === 'media');
  expect(menuItems(media?.loadSubmenu?.() ?? [])).toHaveLength(10_000);
  expect(namesRead).toBeLessThan(21_000);
});
