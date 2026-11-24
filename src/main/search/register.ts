import {libraryEndpoints} from '@contracts/ipc/library';
import type {SongChange} from '@core/schema/services/contentDocuments';
import type {Song} from '@core/schema/songs/song';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {buildSongSearchIndex, type SongSearchIndex} from './songIndex';

/** The songs of the 라이브러리, and their changes. */
export interface SongSource {
  songs(): Iterable<Song>;
  subscribeSongs(listener: (change: SongChange) => void): () => void;
}

/** Indexes the songs; what changes meanwhile is indexed after them. */
async function followSongs(
  source: SongSource,
  ipc: IpcHost,
): Promise<SongSearchIndex> {
  const early: SongChange[] = [];
  let index: SongSearchIndex | null = null;
  ipc.whenClosed(
    source.subscribeSongs(change => {
      if (index === null) early.push(change);
      else index.change(change);
    }),
  );
  const built = await buildSongSearchIndex(source.songs());
  for (const change of early) built.change(change);
  index = built;
  return built;
}

/**
 * Answers the search of the 라이브러리.
 *
 * @returns A function that stops answering.
 */
export function registerLibrarySearch(
  source: Promise<SongSource | null>,
  log: Logger,
): () => void {
  const ipc = new IpcHost(log);
  let disposed = false;
  const ready = source.then(songs =>
    songs === null || disposed ? null : followSongs(songs, ipc),
  );
  ready.catch((error: unknown) =>
    log.error('could not index the song library', error),
  );
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
