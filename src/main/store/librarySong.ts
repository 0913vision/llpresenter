import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {MediaChoice} from '@shared/live';
import type {FileAccess} from '@shared/schema/fileFormat';
import type {SongId} from '@shared/schema/ids';
import type {Label} from '@shared/schema/labels';
import {
  parseShowLibrarySongReply,
  parseShowLibrarySongRequest,
  type ShowLibrarySong,
} from '@shared/schema/showLibrarySong';
import type {AnySong} from '@shared/schema/groupedSong';
import type {Logger} from '../log';
import {jumpKeysOf, projectSongTiles} from './showService';

export interface LibrarySongDocument {
  readonly song: AnySong;
  readonly revision: number;
  readonly access: FileAccess;
}

export interface LibrarySongSources {
  readonly song: (id: SongId) => LibrarySongDocument | null;
  readonly labels: readonly Label[];
  readonly backgroundOf: (id: string) => Promise<MediaChoice | null>;
}

export async function showLibrarySong(
  sources: LibrarySongSources,
  songId: SongId,
): Promise<ShowLibrarySong | null> {
  const document = sources.song(songId);
  if (document === null) return null;
  const {song, revision, access} = document;
  const labels = sources.labels;
  const background =
    song.background === undefined
      ? null
      : await sources.backgroundOf(song.background);
  const colors = new Map(labels.map(({name, color}) => [name, color]));
  const projected = projectSongTiles(song, colors);
  const problem = projected.capped
    ? 'tile-limit'
    : song.background !== undefined && background === null
      ? 'missing-background'
      : access === 'readOnly'
        ? 'newer-version'
        : undefined;
  const projection: ShowLibrarySong = {
    songId: song.id,
    songRevision: revision,
    title: song.title,
    readOnly: access === 'readOnly' || projected.capped,
    tiles: projected.tiles,
    jumpKeys: jumpKeysOf(labels),
    ...(background === null ? {} : {background}),
    ...(problem === undefined ? {} : {problem}),
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
  ipcMain.handle(Channels.libraryShowSong, async (_event, value: unknown) => {
    const request = parseShowLibrarySongRequest(value);
    if (!request.ok) {
      log.warn('dropped a malformed library song request', request.error);
      throw new Error('Invalid library song request');
    }
    try {
      const sources = await ready;
      if (isDisposed()) return null;
      if (sources === null) throw new Error('The song library is unavailable');
      const shown = await showLibrarySong(sources, request.value.songId);
      return isDisposed() ? null : shown;
    } catch (error: unknown) {
      log.error('could not show a library song', error);
      throw new Error('Could not show a library song', {cause: error});
    }
  });
  return () => {
    disposed = true;
    ipcMain.removeHandler(Channels.libraryShowSong);
  };
}
