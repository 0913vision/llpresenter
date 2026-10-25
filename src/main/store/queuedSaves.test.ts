import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {Autosave} from './autosave';
import {QueuedSaves} from './queuedSaves';
import type {WriteResult} from './fileWriter';

function setup() {
  vi.useFakeTimers();
  const log = recordingLogger();
  const autosave = new Autosave(vi.fn(), 500);
  const saves = new QueuedSaves(autosave, log);
  onTestFinished(() => {
    autosave.dispose();
    saves.dispose();
    vi.useRealTimers();
  });
  return {autosave, saves, log};
}

describe('queued document save outcomes', () => {
  it('shares the pending outcome and picks the latest callback when an earlier write was held', async () => {
    const {saves} = setup();
    let release: (result: WriteResult) => void = () => undefined;
    const first = saves.schedule(
      'song',
      () =>
        new Promise<WriteResult>(resolve => {
          release = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(500);
    const stale = vi.fn(async (): Promise<WriteResult> => ({
      ok: true,
      value: undefined,
    }));
    const second = saves.schedule('song', stale);
    await vi.advanceTimersByTimeAsync(500);
    const latest = vi.fn(async (): Promise<WriteResult> => ({
      ok: false,
      error: {file: 'song', message: 'Latest failure'},
    }));
    const third = saves.schedule('song', latest);
    expect(third).toBe(second);
    release({ok: true, value: undefined});
    await vi.advanceTimersByTimeAsync(0);
    expect((await first).ok).toBe(true);
    expect(await second).toMatchObject({
      ok: false,
      error: {message: 'Latest failure'},
    });
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('transfers pending callers to an explicit save and resolves cancelled saves on disposal', async () => {
    const {saves, autosave} = setup();
    const work = vi.fn(async (): Promise<WriteResult> => ({
      ok: true,
      value: undefined,
    }));
    const pending = saves.schedule('current', work);
    const finish = saves.take('current');
    finish({ok: false, error: {file: 'current', message: 'Explicit failure'}});
    expect(await pending).toMatchObject({
      ok: false,
      error: {message: 'Explicit failure'},
    });
    await autosave.flush();
    expect(work).not.toHaveBeenCalled();
    const cancelled = saves.schedule('another', work);
    autosave.dispose();
    saves.dispose();
    expect(await cancelled).toMatchObject({
      ok: false,
      error: {file: 'another'},
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns and logs an unexpected callback failure without leaving a pending caller', async () => {
    const {saves, log} = setup();
    const pending = saves.schedule('song', async () => {
      throw new Error('Serializer failed');
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toEqual({
      ok: false,
      error: {file: 'song', message: 'Serializer failed'},
    });
    expect(log.messages('error')).toContain('could not save a queued document');
  });
});
