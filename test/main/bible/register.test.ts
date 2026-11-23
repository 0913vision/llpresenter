import {describe, expect, it, vi} from 'vitest';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {registerBible} from '@main/bible/register';
import {BibleLookupSession} from '@main/bible/lookup';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({ipcMain: ipc.ipcMain}));

describe('Bible IPC registration', () => {
  it('validates requests, logs read failures, and removes the handler on close', async () => {
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      flush: async () => undefined,
    };
    const stop = registerBible({
      folder: 'unused',
      settings: Promise.resolve(null),
      log,
    });
    try {
      const ask = (value: unknown) => ipc.invoke(bibleEndpoints.lookup, value);
      await expect(ask({})).rejects.toThrow('Malformed bible:lookup request');
      expect(log.warn).toHaveBeenCalledOnce();
      await expect(
        ask({input: '요 3:16', translation: 'sample'}),
      ).rejects.toThrow('Could not look up a Bible passage');
      expect(log.error).toHaveBeenCalledOnce();
    } finally {
      stop();
      stop();
    }
    expect(ipc.has(bibleEndpoints.lookup.channel)).toBe(false);
  });

  it('looks up what the operator asks for, and closes its session', async () => {
    const lookup = vi
      .spyOn(BibleLookupSession.prototype, 'lookup')
      .mockRejectedValue(new Error('Invented lookup stop'));
    const dispose = vi.spyOn(BibleLookupSession.prototype, 'dispose');
    const stop = registerBible({
      folder: 'unused',
      settings: Promise.resolve(null),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        flush: async () => undefined,
      },
    });
    const request = {translation: 'missing', input: '하박국 3:17-19'};
    await expect(ipc.invoke(bibleEndpoints.lookup, request)).rejects.toThrow();
    expect(lookup).toHaveBeenCalledWith(request, false, true);
    stop();
    expect(dispose).toHaveBeenCalledOnce();
    lookup.mockRestore();
    dispose.mockRestore();
  });
});
