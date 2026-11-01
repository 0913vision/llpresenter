import {settingsDocument} from '@core/testing/settingsDocument';
import {expect, it} from 'vitest';
import {menuItems} from '@renderer/ui/menuModel';
import {macroMenuEntries, type MacroMenuInput} from './macroMenuEntries';
import {MACRO_FILE_LIMITS} from '@core/schema/macros';
import {mockHandlers} from './macroMenuTesting';

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
