import {settingsDocument} from '@core/testing/settingsDocument';
import {expect, it, vi} from 'vitest';
import {hasSubmenu, menuItems} from '@renderer/ui/menuModel';
import {
  macroMenuEntries,
  type MacroMenuHandlers,
  type MacroMenuInput,
} from './macroMenuEntries';
import {MACRO_FILE_LIMITS} from '@core/schema/macros';

it('offers theme targets and explains why legacy Look actions cannot be edited', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const doc = settingsDocument('macros', {
    macros: [
      {
        id,
        name: 'Macro',
        icon: 'macro',
        color: 'teal',
        actions: [{kind: 'look', look: id}],
      },
    ],
    collections: [],
  });
  if (doc.name !== 'macros') throw new Error('Invalid fixture');
  const item = doc.value.macros[0];
  if (!item) throw new Error('Missing macro fixture');
  const handlers = mockHandlers();
  const rows = menuItems(
    macroMenuEntries(
      {
        item,
        collections: [],
        shown: undefined,
        macroCount: 1,
        locked: false,
        targets: {theme: [{id, name: 'Theme'}]},
      },
      handlers,
    ),
  );
  expect(rows.find(row => row.id === 'edit-0')).toMatchObject({
    disabled: true,
    title: 'Look 동작은 테마 바꾸기로 교체되었습니다',
  });
  const add = menuItems(
    rows.find(row => row.id === 'add-action')?.submenu ?? [],
  );
  expect(add.some(row => row.id === 'look')).toBe(false);
  menuItems(
    add.find(row => row.id === 'theme')?.loadSubmenu?.() ?? [],
  )[0]?.onSelect?.();
  expect(handlers.chooseAction).toHaveBeenCalledWith(
    expect.objectContaining({kind: 'theme', target: id}),
  );
});

function mockHandlers(): MacroMenuHandlers {
  const mockRun = vi.fn();
  return {
    rename: mockRun,
    changeIcon: mockRun,
    changeColor: mockRun,
    toggleStartup: mockRun,
    addTo: mockRun,
    moveTo: mockRun,
    newCollection: mockRun,
    addAction: mockRun,
    chooseAction: mockRun,
    openAction: mockRun,
    removeAllActions: mockRun,
    openPalette: mockRun,
    removeAction: mockRun,
    duplicate: mockRun,
    remove: mockRun,
  };
}

it('explains macro locks, collection membership, caps, and unavailable action choices', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const document = settingsDocument('macros', {
    macros: [
      {
        id,
        name: '매크로',
        color: 'teal',
        icon: 'macro',
        actions: [{kind: 'stageLayout', layout: id}],
      },
    ],
    collections: [{id, name: '모음', macroIds: [id]}],
  });
  if (document.name !== 'macros') throw new Error('Invalid fixture');
  const item = document.value.macros[0];
  const collection = document.value.collections[0];
  if (!item || !collection) throw new Error('Missing fixture');
  const input: MacroMenuInput = {
    item,
    collections: [collection],
    shown: collection.id,
    macroCount: 1,
    locked: false,
    targets: undefined,
  };
  const rows = (changes: Partial<MacroMenuInput> = {}) =>
    menuItems(macroMenuEntries({...input, ...changes}, mockHandlers()));
  const locked = rows({locked: true});
  for (const id of [
    'add-to',
    'move-to',
    'rename',
    'color',
    'icon',
    'startup',
    'add-action',
    'edit-0',
    'remove-0',
    'duplicate',
    'delete',
  ]) {
    expect(locked.find(row => row.id === id)).toMatchObject({
      disabled: true,
      title: '매크로 목록 잠김',
    });
  }
  const kinds = menuItems(
    rows().find(row => row.id === 'add-action')?.submenu ?? [],
  );
  expect(kinds.find(row => row.id === 'stageLayout')?.title).toBe(
    '무대 배치 동작이 이미 있음',
  );
  expect(kinds.find(row => row.id === 'theme')?.title).toBe(
    '대상을 불러오고 있습니다',
  );
  const empty = menuItems(
    rows({targets: {theme: []}}).find(row => row.id === 'add-action')
      ?.submenu ?? [],
  );
  expect(empty.find(row => row.id === 'theme')?.title).toBe('대상이 없습니다');
  const full = menuItems(
    rows({
      item: {
        ...item,
        actions: Array.from({length: MACRO_FILE_LIMITS.actions}, () => ({
          kind: 'clearAll',
        })),
      },
    }).find(row => row.id === 'add-action')?.submenu ?? [],
  );
  for (const id of ['clear', 'theme', 'stageLayout']) {
    expect(full.find(row => row.id === id)?.title).toBe('동작 한도 도달');
  }
  expect(
    rows({macroCount: MACRO_FILE_LIMITS.macros}).find(
      row => row.id === 'duplicate',
    )?.title,
  ).toBe('매크로 한도 도달');
  const collections = menuItems(
    rows({
      collections: Array.from(
        {length: MACRO_FILE_LIMITS.collections},
        () => collection,
      ),
    }).find(row => row.id === 'add-to')?.submenu ?? [],
  );
  expect(collections[0]?.title).toBe('현재 포함된 모음');
  expect(collections.at(-1)?.title).toBe('모음 한도 도달');
  const unknown = settingsDocument('macros', {
    macros: [{...item, actions: [{kind: 'futureAction'}]}],
    collections: [],
  });
  if (unknown.name !== 'macros' || !unknown.value.macros[0]) {
    throw new Error('Invalid unknown action fixture');
  }
  expect(
    rows({item: unknown.value.macros[0]}).find(row => row.id === 'edit-0')
      ?.title,
  ).toBe('지원하지 않는 동작');
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
