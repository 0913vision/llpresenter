import {describe, expect, it, vi} from 'vitest';
import {Channels} from '@contracts/ipc/api';
import type {RecoveryResult, RecoverySummary} from '@core/schema/recovery';
import {recordingLogger} from '../../displays/testing';
import {registerRecoveryChannels} from './channels';
import type {RecoveryPort} from './controller';

type Handler = (event: unknown, value?: unknown) => unknown;
const handlers = vi.hoisted(() => new Map<string, Handler>());
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

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
        notices: 0,
        stageLayouts: 0,
      },
    },
  ],
};

function invoke(channel: string, value?: unknown): unknown {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing handler ${channel}`);
  return handler({}, value);
}

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
    expect(await invoke(Channels.recoverySummary)).toEqual(SUMMARY);
    const answer = {savedAt: SAVED_AT, rows: ['outputs', 'slide']};
    expect(await invoke(Channels.recoveryApply, answer)).toEqual(OK);
    expect(port.apply).toHaveBeenCalledWith(answer);
    expect(await invoke(Channels.recoveryStartFresh)).toEqual(OK);
    remove();
    expect(handlers.size).toBe(0);
  });

  it('refuses and logs a malformed answer without applying it', async () => {
    const {port, log, remove} = setup();
    for (const value of [
      null,
      {savedAt: SAVED_AT, rows: []},
      {savedAt: SAVED_AT, rows: ['outputs', 'outputs']},
      {savedAt: 'yesterday', rows: ['outputs']},
    ]) {
      expect(await invoke(Channels.recoveryApply, value)).toMatchObject({
        ok: false,
        error: {reason: 'invalid-selection'},
      });
    }
    expect(port.apply).not.toHaveBeenCalled();
    expect(log.messages('warn')).toHaveLength(4);
    remove();
  });

  it('never rejects when the controller fails', async () => {
    const {port, log, remove} = setup();
    port.summary.mockRejectedValueOnce(new Error('summary failed'));
    port.apply.mockRejectedValueOnce(new Error('apply failed'));
    port.startFresh.mockRejectedValueOnce(new Error('fresh failed'));
    expect(await invoke(Channels.recoverySummary)).toBeNull();
    const failed = {ok: false, error: {reason: 'apply-failed'}};
    expect(
      await invoke(Channels.recoveryApply, {
        savedAt: SAVED_AT,
        rows: ['outputs'],
      }),
    ).toMatchObject(failed);
    expect(await invoke(Channels.recoveryStartFresh)).toMatchObject(failed);
    expect(log.messages('error')).toEqual([
      'could not summarize the recovery record',
      'could not restore the output state',
      'could not start fresh after the crash',
    ]);
    remove();
  });
});
