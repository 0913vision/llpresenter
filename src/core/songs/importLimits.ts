import {limitReason} from '../common/limitReason';
import type {GroupedSong} from '../schema/groupedSong';
import {SONG_IMPORT_LIMITS} from '../schema/songImport';

/**
 * Why an imported song cannot be saved yet, or `undefined` when it fits the
 * limits of `song.import`. Main refuses the same songs when it saves.
 */
export function importLimitReason(song: GroupedSong): string | undefined {
  const slides = song.groups.flatMap(group => group.slides);
  if (slides.length > SONG_IMPORT_LIMITS.slides) {
    return limitReason('슬라이드', SONG_IMPORT_LIMITS.slides);
  }
  const lines = slides.reduce((total, slide) => total + slide.lines.length, 0);
  if (lines > SONG_IMPORT_LIMITS.lines) {
    return limitReason('줄', SONG_IMPORT_LIMITS.lines);
  }
  const picks = (song.arrangements ?? []).reduce(
    (total, arrangement) => total + arrangement.groups.length,
    0,
  );
  if (picks > SONG_IMPORT_LIMITS.picks) {
    return limitReason('구성 순서', SONG_IMPORT_LIMITS.picks);
  }
  if ((song.arrangements?.length ?? 0) > SONG_IMPORT_LIMITS.arrangements) {
    return limitReason('구성', SONG_IMPORT_LIMITS.arrangements);
  }
  const {title, groups, background, arrangements} = song;
  if (
    JSON.stringify({title, groups, background, arrangements}).length >
    SONG_IMPORT_LIMITS.characters
  ) {
    return limitReason('글자', SONG_IMPORT_LIMITS.characters);
  }
  return undefined;
}
