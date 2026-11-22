import * as v from 'valibot';
import {themeFileSchema, type ThemeFile} from '../../schema/theme';
import blank from './blank.json';
import creed from './creed.json';
import lyrics from './lyrics.json';
import lyricsLight from './lyrics-light.json';
import media from './media.json';
import notice from './notice.json';
import picture from './picture.json';
import preparation from './preparation.json';
import scripture from './scripture.json';
import sermonTitle from './sermon-title.json';
import songTitle from './song-title.json';
import songTitleLight from './song-title-light.json';
import standby from './standby.json';
import title from './title.json';

/** The themes that come with the app, in the order the editor lists them. */
export const BUILT_IN_THEMES: readonly ThemeFile[] = [
  songTitle,
  lyrics,
  songTitleLight,
  lyricsLight,
  sermonTitle,
  scripture,
  notice,
  title,
  creed,
  preparation,
  standby,
  blank,
  picture,
  media,
].map(theme => v.parse(themeFileSchema, theme));
