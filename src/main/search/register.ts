import {libraryEndpoints} from '@contracts/ipc/library';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import type {SongSearchIndex} from './songIndex';

/** Registers the validated search read and returns its shutdown cleanup. */
export function registerLibrarySearch(
  ready: Promise<Pick<SongSearchIndex, 'search'> | null>,
  log: Logger,
): () => void {
  const ipc = new IpcHost(log);
  let disposed = false;
  ipc.request(libraryEndpoints.search, async request => {
    try {
      const index = await ready;
      return disposed || index === null
        ? {query: request.query, matches: []}
        : index.search(request);
    } catch (error: unknown) {
      log.error('could not search the song library', error);
      throw new Error('Could not search the song library', {cause: error});
    }
  });
  return () => {
    disposed = true;
    ipc.close();
  };
}
