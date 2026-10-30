import {ipcMain} from 'electron';
import {Channels} from '@contracts/ipc/api';
import {parseLibrarySearchRequest} from '@core/schema/librarySearch';
import type {Logger} from '../log';
import type {SongSearchIndex} from './songIndex';

/** Registers the validated search read and returns its shutdown cleanup. */
export function registerLibrarySearch(
  ready: Promise<SongSearchIndex | null>,
  log: Logger,
): () => void {
  let disposed = false;
  ipcMain.handle(Channels.librarySearch, async (_event, value: unknown) => {
    const parsed = parseLibrarySearchRequest(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed library search', parsed.error);
      throw new Error('Invalid library search request');
    }
    try {
      const index = await ready;
      return disposed || index === null
        ? {query: parsed.value.query, matches: []}
        : index.search(parsed.value);
    } catch (error: unknown) {
      log.error('could not search the song library', error);
      throw new Error('Could not search the song library', {cause: error});
    }
  });
  return () => {
    disposed = true;
    ipcMain.removeHandler(Channels.librarySearch);
  };
}
