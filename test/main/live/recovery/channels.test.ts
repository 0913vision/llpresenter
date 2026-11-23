import {describe, expect, it, vi} from 'vitest';
import {recoveryEndpoints} from '@contracts/ipc/recovery';
import type {RecoveryResult, RecoverySummary} from '@core/schema/recovery';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerRecoveryChannels} from '@main/live/recovery/channels';
import type {RecoveryPort} from '@main/live/recovery/controller';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({ipcMain: ipc.ipcMain}));

const SAVED_AT = '2026-10-26T06:00:00+09:00';
const OK: RecoveryResult = {ok: true, value: null};
const SUMMARY: RecoverySummary = {
  savedAt: SAVED_AT,
  rows: [
    {
      kind: 'showing',
      counts: {
        messages: 0,
        props: 0,
        stageMessages: 1,
      },
    },
  ],
};

function setup() {
  const port = {
    summary: vi.fn<RecoveryPort['summary']>().mockResolvedValue(SUMMARY),
    apply: vi.fn<RecoveryPort['apply']>().mockResolvedValue(OK),
    startFresh: vi.fn<RecoveryPort['startFresh']>().mockResolvedValue(OK),
  };
  const log = recordingLogger();
  const remove = registerRecoveryChannels(port, log);
  return {port, log, remove};
}

describe('recovery channels', () => {
  it('answers the three recovery calls and removes its handlers', async () => {
    const {port, remove} = setup();
    expect(await ipc.invoke(recoveryEndpoints.summary)).toEqual(SUMMARY);
    const answer = {savedAt: SAVED_AT, rows: ['outputs', 'slide']};
    expect(await ipc.invoke(recoveryEndpoints.apply, answer)).toEqual(OK);
    expect(port.apply).toHaveBeenCalledWith(answer);
    expect(await ipc.invoke(recoveryEndpoints.startFresh)).toEqual(OK);
    remove();
    expect(ipc.handlers.size).toBe(0);
  });

  it('refuses and logs a malformed answer without applying it', async () => {
    const {port, log, remove} = setup();
    expect(
      await ipc.invoke(recoveryEndpoints.apply, {
        savedAt: SAVED_AT,
        rows: [],
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid-selection'}});
    expect(port.apply).not.toHaveBeenCalled();
    expect(log.messages('warn')).toHaveLength(1);
    remove();
  });

  it('never rejects when the controller fails', async () => {
    const {port, log, remove} = setup();
    port.summary.mockRejectedValueOnce(new Error('summary failed'));
    port.apply.mockRejectedValueOnce(new Error('apply failed'));
    port.startFresh.mockRejectedValueOnce(new Error('fresh failed'));
    expect(await ipc.invoke(recoveryEndpoints.summary)).toBeNull();
    const failed = {ok: false, error: {reason: 'apply-failed'}};
    expect(
      await ipc.invoke(recoveryEndpoints.apply, {
        savedAt: SAVED_AT,
        rows: ['outputs'],
      }),
    ).toMatchObject(failed);
    expect(await ipc.invoke(recoveryEndpoints.startFresh)).toMatchObject(
      failed,
    );
    expect(log.messages('error')).toEqual([
      'could not summarize the recovery record',
      'could not restore the output state',
      'could not start fresh after the crash',
    ]);
    remove();
  });
});
