import {expect, it, vi} from 'vitest';
import {
  mergeSettingsDocument,
  parseSettingsDocument,
  parseSettingsEdit,
} from '@shared/schema/settingsDocuments';
import {isKnownMacroAction, MACRO_FILE_LIMITS} from '@shared/schema/macros';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {editMacroActions} from './macroActionEdits';
import {saveMacroEdit} from './macroEdits';

const id = '00000000-0000-4000-8000-000000000001';
function document(actions: readonly object[], revision = 1) {
  const parsed = parseSettingsDocument({
    name: 'macros',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.macros',
      schemaVersion: 1,
      macros: [
        {id, name: '예배', icon: 'star', color: 'teal', actions, future: true},
      ],
      collections: [],
    },
  });
  if (!parsed.ok || parsed.value.name !== 'macros') {
    throw new Error('Invalid fixture');
  }
  return parsed.value;
}
const item = document([
  {kind: 'clearAll'},
  {kind: 'clearLayer', layer: 'slide'},
  {kind: 'future', data: 1},
]).value.macros[0];
if (!item) throw new Error('Missing fixture');
const first = item.actions[0];
const second = item.actions[1];
if (
  !first ||
  !second ||
  !isKnownMacroAction(first) ||
  !isKnownMacroAction(second)
) {
  throw new Error('Missing actions');
}

it('adds, replaces, removes and reorders without losing unknown actions', () => {
  const actions = item.actions;
  expect(editMacroActions(actions, {kind: 'append', action: first})).toEqual([
    ...actions,
    first,
  ]);
  expect(
    editMacroActions(actions, {
      kind: 'replace',
      index: 0,
      action: second,
      expected: actions,
    }),
  ).toEqual([second, second, actions[2]]);
  expect(
    editMacroActions(actions, {kind: 'remove', index: 1, expected: actions}),
  ).toEqual([first, actions[2]]);
  expect(
    editMacroActions(actions, {
      kind: 'move',
      index: 2,
      to: 0,
      expected: actions,
    }),
  ).toEqual([actions[2], first, second]);
});

it('rejects changed snapshots and bounds both indices and the action count', () => {
  expect(() =>
    editMacroActions(item.actions, {kind: 'remove', index: 0, expected: []}),
  ).toThrow('changed');
  expect(() =>
    editMacroActions(item.actions, {
      kind: 'move',
      index: 0,
      to: 5,
      expected: item.actions,
    }),
  ).toThrow('position');
  expect(() =>
    editMacroActions(
      Array.from({length: MACRO_FILE_LIMITS.actions}, () => first),
      {kind: 'append', action: first},
    ),
  ).toThrow('full');
});

it('appends to the latest revision without losing another action', async () => {
  const initial = document([first]);
  const newer = document([first, second], 2);
  const get = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(newer);
  const edit = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'stale'},
    })
    .mockResolvedValue({ok: true, value: {id: 'macros', revision: 3}});
  const api = fakeLlpApi({settings: {get, edit}});
  await saveMacroEdit(api, {
    kind: 'action',
    id: item.id,
    action: {kind: 'append', action: first},
  });
  expect(edit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      baseRevision: 2,
      value: {
        ...newer.value,
        macros: [{...newer.value.macros[0], actions: [first, second, first]}],
      },
    }),
  );
});

it('does not overwrite a concurrently changed list on a retried removal', async () => {
  const initial = document([first]);
  const newer = document([first, second], 2);
  const get = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(newer);
  const edit = vi
    .fn()
    .mockResolvedValue({ok: false, error: {reason: 'stale', message: 'stale'}});
  const api = fakeLlpApi({settings: {get, edit}});
  await expect(
    saveMacroEdit(api, {
      kind: 'action',
      id: item.id,
      action: {kind: 'remove', index: 0, expected: [first]},
    }),
  ).rejects.toThrow('changed');
  expect(edit).toHaveBeenCalledOnce();
});

it('removes every action together and refuses a stale remove-all snapshot', () => {
  expect(
    editMacroActions(item.actions, {kind: 'removeAll', expected: item.actions}),
  ).toEqual([]);
  expect(() =>
    editMacroActions(item.actions, {kind: 'removeAll', expected: []}),
  ).toThrow('changed');
});

it.each(['remove', 'move'] as const)(
  'keeps action identity through the real settings merge after %s',
  operation => {
    const current = document([
      {kind: 'future', layer: 'slide'},
      {kind: 'clearLayer', prop: id},
    ]);
    const macro = current.value.macros[0];
    if (!macro) throw new Error('Missing macro');
    const actions =
      operation === 'remove'
        ? editMacroActions(macro.actions, {
            kind: 'remove',
            index: 0,
            expected: macro.actions,
          })
        : editMacroActions(macro.actions, {
            kind: 'move',
            index: 1,
            to: 0,
            expected: macro.actions,
          });
    const edit = parseSettingsEdit({
      type: 'settings.update',
      name: 'macros',
      baseRevision: 1,
      value: {...current.value, macros: [{...macro, actions}]},
    });
    if (!edit.ok) throw new Error('Invalid edit');
    const merged = mergeSettingsDocument(current, edit.value);
    expect(merged.ok).toBe(true);
    if (!merged.ok || merged.value.name !== 'macros') {
      throw new Error('Invalid merged document');
    }
    expect(merged.value.value.macros[0]?.actions).toEqual(actions);
  },
);
