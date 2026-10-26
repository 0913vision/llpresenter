import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import {parseBibleLookupRequest} from '@shared/schema/bibleLookup';
import {BibleLookupSession, type BibleLookupOptions} from './lookup';

/** Registers the validated Bible read and releases retained text on shutdown. */
export function registerBible(options: BibleLookupOptions): () => void {
  const session = new BibleLookupSession(options);
  ipcMain.handle(Channels.bibleLookup, async (_event, value: unknown) => {
    const request = parseBibleLookupRequest(value);
    if (!request.ok) {
      options.log.warn('dropped a malformed Bible lookup', request.error);
      throw new Error('Invalid Bible lookup request');
    }
    try {
      return await session.lookup(request.value);
    } catch (error: unknown) {
      options.log.error('could not look up a Bible passage', error);
      throw new Error('Could not look up a Bible passage', {cause: error});
    }
  });
  return () => {
    session.dispose();
    ipcMain.removeHandler(Channels.bibleLookup);
  };
}
