import {expect, it} from 'vitest';
import * as v from 'valibot';
import {createMessageTemplateId, macroIdSchema} from '@core/schema/common/ids';
import {deletesMacro} from '@renderer/features/tools/macros/macroEdits';
import {deletesMessage} from '@renderer/features/tools/messages/messageEdits';

const UUID = '00000000-0000-4000-8000-000000000001';

it('counts a deleted macro and actions taken out of one as deletions, and nothing else', () => {
  const id = v.parse(macroIdSchema, UUID);
  expect(deletesMacro({kind: 'delete', id})).toBe(true);
  expect(
    deletesMacro({
      kind: 'action',
      id,
      action: {kind: 'removeAll', expected: []},
    }),
  ).toBe(true);
  expect(deletesMacro({kind: 'update', id, changes: {name: '새 이름'}})).toBe(
    false,
  );
});

it('counts a deleted message template as a deletion', () => {
  expect(
    deletesMessage({kind: 'delete', id: createMessageTemplateId(UUID)}),
  ).toBe(true);
});
