import {createThemeId} from '@core/schema/ids';
import type {SlidePurpose} from '@core/schema/theme';

function id(number: number) {
  return createThemeId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
}

/** The theme of the app for each kind of slide. */
export const BUILT_IN_THEME_IDS = {
  songTitle: id(150),
  lyrics: id(101),
  sermonTitle: id(106),
  scripture: id(102),
  notice: id(105),
  title: id(111),
  creed: id(371),
  preparation: id(110),
  standby: id(100),
  blank: id(153),
  picture: id(108),
  media: id(104),
} as const satisfies Record<SlidePurpose, unknown>;

/** The song themes: white texts, and black ones for a bright background. */
export const SONG_THEME_IDS = {
  dark: {
    title: BUILT_IN_THEME_IDS.songTitle,
    hymnTitle: id(154),
    lyrics: BUILT_IN_THEME_IDS.lyrics,
  },
  light: {title: id(151), hymnTitle: id(155), lyrics: id(398)},
} as const;
