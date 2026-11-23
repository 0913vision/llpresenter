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
    const session = new BibleLookupSession({
      folder: 'unused',
      settings: Promise.resolve(null),
      log,
    });
    const stop = registerBible({session, log});
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
      session.dispose();
    }
    expect(ipc.has(bibleEndpoints.lookup.channel)).toBe(false);
  });
});
