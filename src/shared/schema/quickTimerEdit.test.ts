import {describe, expect, it} from 'vitest';
import {parseSettingsEdit} from './settingsDocuments';
import {MAX_TIMER_SECONDS, TIMER_NAME_LIMIT} from './quickTimerEdit';

const quickItemId = '00000000-0000-4000-8000-000000000001';
const timerId = '00000000-0000-4000-8000-000000000002';
const create = {
  type: 'quick.timer.create',
  name: 'quick',
  quickItemId,
  timerId,
  duration: 90,
};
const rename = {
  type: 'quick.timer.rename',
  name: 'quick',
  quickItemId,
  timerName: '설교',
};

describe('quick timer edit boundary', () => {
  it('accepts a duration and distinct checked IDs without a stale whole-file copy', () => {
    expect(parseSettingsEdit({...create, future: true})).toEqual({
      ok: true,
      value: create,
    });
    expect(parseSettingsEdit({...create, duration: MAX_TIMER_SECONDS}).ok).toBe(
      true,
    );
  });

  it.each([0, -1, 0.5, NaN, Infinity, MAX_TIMER_SECONDS + 1, '90', null])(
    'rejects duration %s',
    duration => {
      expect(parseSettingsEdit({...create, duration}).ok).toBe(false);
    },
  );

  it.each([
    {...create, quickItemId: 'row'},
    {...create, timerId: quickItemId},
    {...create, timerId: 'timer'},
    {...create, name: 'timers'},
    {...create, duration: undefined},
  ])('rejects malformed create identities or missing data', value => {
    expect(parseSettingsEdit(value).ok).toBe(false);
  });

  it('normalizes a bounded rename and keeps the quick settings discriminator', () => {
    expect(
      parseSettingsEdit({
        type: rename.type,
        name: 'quick',
        quickItemId,
        timerName: ' 설교 ',
      }),
    ).toEqual({
      ok: true,
      value: {type: rename.type, name: 'quick', quickItemId, timerName: '설교'},
    });
  });

  it.each(['', '  ', '가'.repeat(TIMER_NAME_LIMIT + 1), null, 5])(
    'rejects invalid timer name %s',
    timerName => {
      expect(
        parseSettingsEdit({
          type: rename.type,
          name: 'quick',
          quickItemId,
          timerName,
        }).ok,
      ).toBe(false);
    },
  );
});
