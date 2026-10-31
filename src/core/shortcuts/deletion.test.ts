import {expect, it} from 'vitest';
import {settingsDocument} from '../testing/settingsDocument';
import type {SettingsDocument, SettingsName} from '../schema/settingsDocuments';
import {deletedObjectShortcuts} from './deletion';

const ID = '44000000-0000-4000-8000-000000000001';

it('removes deleted object bindings and keeps unknown IDs and fields', () => {
  const macros = settingsDocument('macros', {
    macros: [{id: ID, name: '점검', icon: 'macro', color: 'teal', actions: []}],
    collections: [],
  });
  const shortcuts = settingsDocument(
    'shortcuts',
    {
      extra: 'kept',
      bindings: {
        [`macro.${ID}`]: [{code: 'F8', mods: []}],
        'future.command': [{code: 'F9', mods: [], extra: true}],
      },
    },
    4,
  );
  const current = new Map<SettingsName, SettingsDocument>([
    ['macros', macros],
    ['shortcuts', shortcuts],
  ]);
  const next = settingsDocument('macros', {macros: [], collections: []}, 2);
  expect(deletedObjectShortcuts(current, [next])).toMatchObject({
    name: 'shortcuts',
    revision: 5,
    value: {
      extra: 'kept',
      bindings: {'future.command': [{code: 'F9', mods: [], extra: true}]},
    },
  });
  expect(
    deletedObjectShortcuts(current, [next])?.value.bindings[`macro.${ID}`],
  ).toBeUndefined();
  expect(deletedObjectShortcuts(current, [macros])).toBeNull();
});
