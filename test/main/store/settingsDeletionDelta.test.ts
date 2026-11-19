import {expect, it} from 'vitest';
import {applySettingsDeletionDelta} from '@main/store/settingsDeletionDelta';

it('restores repeated references in their original order around later additions', () => {
  const current = {ids: ['A', 'A', 'later']};
  const after = {ids: ['A', 'A']};
  const before = {ids: ['A', 'X', 'A']};
  const undo = applySettingsDeletionDelta(current, after, before);
  expect(undo).toEqual({ok: true, value: {ids: ['A', 'X', 'A', 'later']}});
  if (!undo.ok) throw new Error('Undo failed');
  expect(applySettingsDeletionDelta(undo.value, before, after)).toEqual({
    ok: true,
    value: current,
  });
});

it('preserves unrelated row edits and refuses a replacement with the deleted identity', () => {
  const before = {
    rows: [
      {id: 'one', name: 'Deleted'},
      {id: 'two', name: 'Original'},
    ],
  };
  const after = {rows: [{id: 'two', name: 'Original'}]};
  expect(
    applySettingsDeletionDelta(
      {rows: [{id: 'two', name: 'Changed'}]},
      after,
      before,
    ),
  ).toEqual({
    ok: true,
    value: {
      rows: [
        {id: 'one', name: 'Deleted'},
        {id: 'two', name: 'Changed'},
      ],
    },
  });
  expect(
    applySettingsDeletionDelta(
      {
        rows: [
          {id: 'one', name: 'Replacement'},
          {id: 'two', name: 'Original'},
        ],
      },
      after,
      before,
    ),
  ).toEqual({ok: false});
});
