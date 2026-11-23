import {bibleEndpoints} from '@contracts/ipc/bible';
import {IpcHost} from '../base/ipcHost';
import {BibleLookupSession, type BibleLookupOptions} from './lookup';

/**
 * Answers the lookups of Bible passages.
 *
 * @returns A function that stops answering.
 */
export function registerBible(options: BibleLookupOptions): () => void {
  const {log} = options;
  const ipc = new IpcHost(log);
  const session = new BibleLookupSession(options);
  ipc.whenClosed(() => {
    session.dispose();
  });
  ipc.request(bibleEndpoints.lookup, async request => {
    try {
      return await session.lookup(request, false, true);
    } catch (error: unknown) {
      log.error('could not look up a Bible passage', error);
      throw new Error('Could not look up a Bible passage', {cause: error});
    }
  });
  return () => {
    ipc.close();
  };
}
