import {describe, expect, it, vi} from 'vitest';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {registerBible} from './register';
import {BibleLookupSession} from './lookup';

type Handler = (event: unknown, value: unknown) => Promise<unknown>;
const handlers = vi.hoisted(() => new Map<string, Handler>());
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

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
      const handler = handlers.get(bibleEndpoints.lookup.channel);
      if (handler === undefined) {
        throw new Error('Missing Bible lookup handler');
      }
      await expect(handler({}, {})).rejects.toThrow(
        'Invalid Bible lookup request',
      );
      expect(log.warn).toHaveBeenCalledOnce();
      await expect(
        handler({}, {input: '요 3:16', translation: 'sample'}),
      ).rejects.toThrow('Could not look up a Bible passage');
      expect(log.error).toHaveBeenCalledOnce();
    } finally {
      stop();
      stop();
      session.dispose();
    }
    expect(handlers.has(bibleEndpoints.lookup.channel)).toBe(false);
  });
});
