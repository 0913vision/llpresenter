import {copyName} from '../common/copyName';

/** The longest song title, in characters. */
export const SONG_TITLE_LIMIT = 200;

export const EMPTY_TITLE_REASON = '곡 제목을 적어야 저장할 수 있습니다';
export const DUPLICATE_TITLE_REASON = '라이브러리에 같은 제목의 곡이 있습니다';

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
