import {expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {isKnownMacroAction} from '@core/schema/macros';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {saveMacroEdit} from '@renderer/features/tools/macroEdits';

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

it('does not overwrite a concurrently changed list on a retried removal', async () => {
  const initial = document([first]);
  const newer = document([first, second], 2);
  const get = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(newer);
  const edit = vi
    .fn()
    .mockResolvedValue({ok: false, error: {reason: 'stale', message: 'stale'}});
  const api = mockLlpApi({settings: {get, edit}});
  await expect(
    saveMacroEdit(api, {
      kind: 'action',
      id: item.id,
      action: {kind: 'remove', index: 0, expected: [first]},
    }),
  ).rejects.toThrow('changed');
  expect(edit).toHaveBeenCalledOnce();
});
