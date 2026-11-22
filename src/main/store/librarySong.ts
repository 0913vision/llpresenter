import {ipcMain} from 'electron';
import {libraryEndpoints} from '@contracts/ipc/library';
import type {FileAccess} from '@core/schema/fileFormat';
import type {SongId} from '@core/schema/ids';
import type {Label} from '@core/schema/labels';
import {
  parseShowLibrarySongReply,
  parseShowLibrarySongRequest,
  type ShowLibrarySong,
} from '@core/schema/showLibrarySong';
import type {Song} from '@core/schema/song';
import {songTiles} from '@core/slides';
import type {Logger} from '../log';

export interface LibrarySongDocument {
  readonly song: Song;
  readonly revision: number;
  readonly access: FileAccess;
}

export interface LibrarySongSources {
  readonly song: (id: SongId) => LibrarySongDocument | null;
  readonly labels: readonly Label[];
}

export function showLibrarySong(
  {song: songOf, labels}: LibrarySongSources,
  songId: SongId,
): ShowLibrarySong | null {
  const document = songOf(songId);
  if (document === null) return null;
  const {song, revision, access} = document;
  const colors = new Map(labels.map(({name, color}) => [name, color]));
  const projection: ShowLibrarySong = {
    songId: song.id,
    songRevision: revision,
    title: song.title,
    readOnly: access === 'readOnly',
    tiles: songTiles(song, colors),
    ...(access === 'readOnly' ? {problem: 'newer-version' as const} : {}),
  };
  const checked = parseShowLibrarySongReply(songId, projection);
  if (!checked.ok) {
    throw new Error(`${checked.error.field}: ${checked.error.message}`);
  }
  return checked.value;
}

/** Registers a read-only projection and releases its IPC handler on shutdown. */
export function registerLibrarySong(
  ready: Promise<LibrarySongSources | null>,
  log: Logger,
): () => void {
  let disposed = false;
  const isDisposed = () => disposed;
  ipcMain.handle(
    libraryEndpoints.showSong.channel,
    async (_event, value: unknown) => {
      const request = parseShowLibrarySongRequest(value);
      if (!request.ok) {
        log.warn('dropped a malformed library song request', request.error);
        throw new Error('Invalid library song request');
      }
      try {
        const sources = await ready;
        if (isDisposed()) return null;
        if (sources === null) {
          throw new Error('The song library is unavailable');
        }
        return showLibrarySong(sources, request.value.songId);
      } catch (error: unknown) {
        log.error('could not show a library song', error);
        throw new Error('Could not show a library song', {cause: error});
      }
    },
  );
  return () => {
    disposed = true;
    ipcMain.removeHandler(libraryEndpoints.showSong.channel);
  };
}
