import {expect, it} from 'vitest';
import {parseSettingsEdit} from './settingsDocuments';
import {TIMER_NAME_LIMIT} from './quickTimerEdit';

const edit = {
  type: 'timer.rename',
  name: 'timers',
  timerId: '00000000-0000-4000-8000-000000000001',
  timerName: '설교',
};

it('accepts a bounded targeted rename and normalizes its name', () => {
  expect(
    parseSettingsEdit({...edit, timerName: ' 설교 ', future: true}),
  ).toEqual({ok: true, value: edit});
  expect(
    parseSettingsEdit({...edit, timerName: '가'.repeat(TIMER_NAME_LIMIT)}).ok,
  ).toBe(true);
});

it.each([
  {...edit, name: 'quick'},
  {...edit, timerId: 'timer'},
  {...edit, timerId: undefined},
  {...edit, timerName: ''},
  {...edit, timerName: '  '},
  {...edit, timerName: null},
  {...edit, timerName: 1},
  {...edit, timerName: '가'.repeat(TIMER_NAME_LIMIT + 1)},
])('rejects malformed rename: %j', value => {
  expect(parseSettingsEdit(value).ok).toBe(false);
});
