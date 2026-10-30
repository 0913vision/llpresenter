import {ipcMain} from 'electron';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import type {BibleLookupSession} from './lookup';
import type {Logger} from '../log';

/** Registers validated reads using the data store's shared Bible session. */
export function registerBible({
  session,
  log,
}: {
  readonly session: Pick<BibleLookupSession, 'lookup'>;
  readonly log: Logger;
}): () => void {
  ipcMain.handle(
    bibleEndpoints.lookup.channel,
    async (_event, value: unknown) => {
      const request = parseBibleLookupRequest(value);
      if (!request.ok) {
        log.warn('dropped a malformed Bible lookup', request.error);
        throw new Error('Invalid Bible lookup request');
      }
      try {
        return await session.lookup(request.value);
      } catch (error: unknown) {
        log.error('could not look up a Bible passage', error);
        throw new Error('Could not look up a Bible passage', {cause: error});
      }
    },
  );
  return () => {
    ipcMain.removeHandler(bibleEndpoints.lookup.channel);
  };
}
