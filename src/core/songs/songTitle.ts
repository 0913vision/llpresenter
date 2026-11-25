import {copyName} from '@core/common/copyName';

/** The longest song title, in characters. */
export const SONG_TITLE_LIMIT = 200;

/** Why a song with a blank title cannot be saved. */
export const EMPTY_TITLE_REASON = '곡 제목을 적어야 저장할 수 있습니다.';
/** Why a song whose title is already in the 라이브러리 cannot be saved. */
export const DUPLICATE_TITLE_REASON = '라이브러리에 같은 제목의 곡이 있습니다.';
/** Why a song with a title longer than {@link SONG_TITLE_LIMIT} cannot be saved. */
export const LONG_TITLE_REASON = '곡 제목이 너무 깁니다.';

/** Matches main's title identity before duplicate checks and persistence. */
export function normalizeSongTitle(value: string): string {
  return value.trim().normalize('NFC');
}

/** The title of a copy of a song, by the one copy-name rule. */
export function copyTitle(title: string, taken: Iterable<string>): string {
  return copyName(title, taken, {
    normalize: normalizeSongTitle,
    maxLength: SONG_TITLE_LIMIT,
  });
}

/**
 * Why `value` cannot be the title of song `songId`: it is blank, too long, or
 * the title of another song of the 라이브러리.
 */
export function songTitleReason(
  value: string,
  songId: string,
  songs: ReadonlyArray<{readonly id: string; readonly title: string}>,
): string | undefined {
  const title = normalizeSongTitle(value);
  if (title === '') return EMPTY_TITLE_REASON;
  if (title.length > SONG_TITLE_LIMIT) return LONG_TITLE_REASON;
  return songs.some(
    song => song.id !== songId && normalizeSongTitle(song.title) === title,
  )
    ? DUPLICATE_TITLE_REASON
    : undefined;
}
