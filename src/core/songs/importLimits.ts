import {limitReason} from '../common/limitReason';
import type {Song} from '../schema/song';
import {SONG_IMPORT_LIMITS} from '../schema/songImport';

/**
 * Why an imported song cannot be saved yet, or `undefined` when it fits the
 * limits of `song.import`. Main refuses the same songs when it saves.
 */
export function importLimitReason(song: Song): string | undefined {
  const slides = song.slides;
  if (slides.length > SONG_IMPORT_LIMITS.slides) {
    return limitReason('슬라이드', SONG_IMPORT_LIMITS.slides);
  }
  const lines = slides.reduce((total, slide) => total + slide.lines.length, 0);
  if (lines > SONG_IMPORT_LIMITS.lines) {
    return limitReason('줄', SONG_IMPORT_LIMITS.lines);
  }
  const {title, background} = song;
  if (
    JSON.stringify({title, slides, background}).length >
    SONG_IMPORT_LIMITS.characters
  ) {
    return limitReason('글자', SONG_IMPORT_LIMITS.characters);
  }
  return undefined;
}
