import {withSongTitle} from '@core/slides';
import type {EditResult} from '@core/schema/services/contentEdit';
import type {SongId} from '@core/schema/common/ids';
import {copyTitle, normalizeSongTitle} from '@core/songs';
import type {LibraryApi} from './useLibrary';

/** What a song command needs from the 곡 라이브러리 panel. */
export interface SongCommandContext {
  readonly api: LibraryApi;
  /**
   * The id of the song an edit changed. A refused edit is reported and gives
   * null; a change that was applied but not saved is reported and still
   * gives its id.
   */
  readonly applied: (result: EditResult) => string | null;
  /** Reads the song list again, so the change shows at once. */
  readonly relist: () => Promise<void>;
  readonly isActive: () => boolean;
  /** Reports a song that is no longer there. */
  readonly missing: () => void;
}

/** Makes a new empty song; gives its id once the list shows it. */
export async function createSong(
  context: SongCommandContext,
): Promise<string | null> {
  const id = context.applied(
    await context.api.content.edit({type: 'song.create'}),
  );
  if (id === null || !context.isActive()) return null;
  await context.relist();
  return id;
}

/**
 * Copies a song: its groups, 이름표, 구성, and background under a new id and
 * the copy title. Gives the copy's id once the list shows it.
 */
export async function duplicateSong(
  context: SongCommandContext,
  id: SongId,
  takenTitles: readonly string[],
): Promise<string | null> {
  const source = await context.api.songs.get(id);
  if (source === null) {
    context.missing();
    return null;
  }
  const title = copyTitle(source.song.title, takenTitles);
  const copyId = context.applied(
    await context.api.content.edit({
      type: 'song.saveAs',
      song: {
        ...source.song,
        title,
        slides: withSongTitle(source.song.slides, source.song.title, title),
      },
    }),
  );
  if (copyId === null || !context.isActive()) return null;
  await context.relist();
  return copyId;
}

/** Deletes a song; true once the list no longer shows it. */
export async function deleteSong(
  context: SongCommandContext,
  id: SongId,
): Promise<boolean> {
  const result = await context.api.content.edit({
    type: 'song.delete',
    songId: id,
  });
  if (!context.isActive() || context.applied(result) === null) return false;
  await context.relist();
  return context.isActive();
}

/**
 * Gives a song a new title by the 곡 편집 title rule. A title another song
 * has is refused with `false`, as main refuses it.
 */
export async function renameSong(
  context: SongCommandContext,
  id: SongId,
  title: string,
): Promise<boolean> {
  const document = await context.api.songs.get(id);
  if (!context.isActive()) return false;
  if (document === null) {
    context.missing();
    return false;
  }
  const result = await context.api.content.edit({
    type: 'song.update',
    baseRevision: document.revision,
    song: {...document.song, title: normalizeSongTitle(title)},
  });
  if (!result.ok && result.error.reason === 'duplicate-title') return false;
  if (!context.isActive() || context.applied(result) === null) return false;
  await context.relist();
  return context.isActive();
}
