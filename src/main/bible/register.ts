import {bibleEndpoints} from '@contracts/ipc/bible';
import type {BibleLookupSession} from './lookup';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';

/** Registers validated reads using the data store's shared Bible session. */
export function registerBible({
  session,
  log,
}: {
  readonly session: Pick<BibleLookupSession, 'lookup'>;
  readonly log: Logger;
}): () => void {
  const ipc = new IpcHost(log);
  ipc.request(bibleEndpoints.lookup, async request => {
    try {
      return await session.lookup(request, false, true);
    } catch (error: unknown) {
      log.error('could not look up a Bible passage', error);
      throw new Error('Could not look up a Bible passage', {cause: error});
    }
  });
  return () => ipc.close();
}
