import type {LibrarySong} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import {
  DUPLICATE_TITLE_REASON,
  EMPTY_TITLE_REASON,
  normalizeSongTitle,
  SONG_TITLE_LIMIT,
} from '@core/songs/songTitle';

/**
 * Why a title cannot be saved for a library song, by the rule of the 곡 편집
 * title field: it must not be empty or too long, and no other song has it.
 */
export function songTitleReason(
  value: string,
  songId: SongId,
  songs: readonly LibrarySong[],
): string | undefined {
  const title = normalizeSongTitle(value);
  if (title === '') return EMPTY_TITLE_REASON;
  if (title.length > SONG_TITLE_LIMIT) {
    return '곡 제목이 너무 깁니다';
  }
  return songs.some(
    song => song.id !== songId && normalizeSongTitle(song.title) === title,
  )
    ? DUPLICATE_TITLE_REASON
    : undefined;
}
