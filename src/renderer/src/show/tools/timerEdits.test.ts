import {expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {createTimerId} from '@shared/schema/ids';
import {MAX_TIMER_DEFINITIONS, MAX_TIMER_SECONDS} from '@shared/schema/timers';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {deferred} from '../quick/quickTesting';
import {saveNewCountdown} from './timerEdits';

const id = createTimerId('00000000-0000-4000-8000-000000000001');
const fields = {id, duration: 30, overrun: false};
function document(
  timers: readonly object[] = [],
  access = 'editable',
  revision = 1,
) {
  const parsed = parseSettingsDocument({
    name: 'timers',
    revision,
    access,
    value: {
      format: 'llsettings.timers',
      schemaVersion: 1,
      timers,
      future: {kept: true},
    },
  });
  if (!parsed.ok || parsed.value.name !== 'timers') {
    throw new Error('Invalid timer fixture');
  }
  return parsed.value;
}

it('adds a separately named definition and keeps unknown fields', async () => {
  const value = document([
    {
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'clock',
      name: '타이머 1',
      future: 'kept',
    },
  ]);
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: 'timers', revision: 2}});
  const api = fakeLlpApi({settings: {get: async () => value, edit}});
  await expect(saveNewCountdown(api, fields)).resolves.toMatchObject({
    ok: true,
  });
  expect(edit).toHaveBeenCalledExactlyOnceWith({
    type: 'settings.update',
    name: 'timers',
    baseRevision: 1,
    value: {
      ...value.value,
      timers: [
        ...value.value.timers,
        {...fields, kind: 'countdown', name: '타이머 2'},
      ],
    },
  });
});

it('holds close through a deferred read and retries on the newest document', async () => {
  const reading = deferred<ReturnType<typeof document>>();
  const get = vi
    .fn()
    .mockReturnValueOnce(reading.promise)
    .mockResolvedValue(document([], 'editable', 2));
  const edit = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Fixture revision'},
    })
    .mockResolvedValue({ok: true, value: {id: 'timers', revision: 3}});
  const api = fakeLlpApi({settings: {get, edit}});
  const saving = saveNewCountdown(api, fields);
  let closed = false;
  const closing = pendingWritesOf(api)
    .flush()
    .then(ok => {
      closed = true;
      return ok;
    });
  await Promise.resolve();
  expect(closed).toBe(false);
  reading.resolve(document());
  await saving;
  expect(await closing).toBe(true);
  expect(edit).toHaveBeenLastCalledWith(
    expect.objectContaining({baseRevision: 2}),
  );
});

it('accepts an applied disk warning without retrying', async () => {
  const edit = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      reason: 'write-failed',
      message: 'Fixture disk',
      applied: {id: 'timers', revision: 2},
      unchangedFiles: ['timers.json'],
    },
  });
  const api = fakeLlpApi({settings: {get: async () => document(), edit}});
  await expect(saveNewCountdown(api, fields)).resolves.toMatchObject({
    ok: false,
    error: {reason: 'write-failed'},
  });
  expect(edit).toHaveBeenCalledOnce();
  expect(await pendingWritesOf(api).flush()).toBe(true);
});

it('recognizes an identical applied definition and refuses an occupied ID', async () => {
  const edit = vi.fn();
  const get = vi
    .fn()
    .mockResolvedValue(
      document([{...fields, kind: 'countdown', name: '타이머 1'}]),
    );
  const api = fakeLlpApi({settings: {get, edit}});
  await expect(saveNewCountdown(api, fields)).resolves.toMatchObject({
    ok: true,
  });
  expect(edit).not.toHaveBeenCalled();
  get.mockResolvedValue(document([{id, name: 'Existing', kind: 'clock'}]));
  await expect(saveNewCountdown(api, fields)).rejects.toThrow('already in use');
});

it('refuses read-only, full and invalid writes', async () => {
  const edit = vi.fn();
  const get = vi.fn().mockResolvedValue(document([], 'readOnly'));
  const api = fakeLlpApi({settings: {get, edit}});
  await expect(saveNewCountdown(api, fields)).rejects.toThrow(
    'cannot be edited',
  );
  get.mockResolvedValue(
    document(
      Array.from({length: MAX_TIMER_DEFINITIONS}, (_, n) => ({
        id: `00000000-0000-4000-8000-${String(n + 10).padStart(12, '0')}`,
        name: 'Fixture',
        kind: 'clock',
      })),
    ),
  );
  await expect(saveNewCountdown(api, fields)).rejects.toThrow('full');
  for (const duration of [0, -1, 0.5, NaN, Infinity, MAX_TIMER_SECONDS + 1]) {
    await expect(saveNewCountdown(api, {...fields, duration})).rejects.toThrow(
      'Invalid countdown',
    );
  }
  expect(edit).not.toHaveBeenCalled();
});
