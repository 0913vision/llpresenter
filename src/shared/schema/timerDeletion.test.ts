import {expect, it} from 'vitest';
import {parseSettingsEdit} from './settingsDocuments';

const edit = {
  type: 'timer.delete',
  name: 'timers',
  timerId: '00000000-0000-4000-8000-000000000001',
};
it('accepts one checked timer ID and strips unrecognized command fields', () => {
  expect(parseSettingsEdit({...edit, extra: true})).toEqual({
    ok: true,
    value: edit,
  });
});
it.each([
  {...edit, name: 'quick'},
  {...edit, timerId: undefined},
  {...edit, timerId: null},
  {...edit, timerId: 'timer'},
  {...edit, timerId: [edit.timerId]},
  {...edit, timerId: '00000000-0000-5000-8000-000000000001'},
])('rejects a malformed targeted deletion: %j', value => {
  expect(parseSettingsEdit(value).ok).toBe(false);
});
