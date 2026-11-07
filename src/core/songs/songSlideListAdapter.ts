import {checkPart} from '../schema/fileFormat';
import {SONG_LIMITS, songSlidesSchema, type SongSlide} from '../schema/song';
import {newSongSlideId, type SlideIdFactory} from './slideEdits';
import type {SlideListAdapter} from './slideListEdits';

/** Library editors pass minimum 1; service song items allow an empty deck. */
export function songSlideListAdapter(
  options: {readonly newId?: SlideIdFactory; readonly minimum?: 0 | 1} = {},
): SlideListAdapter<SongSlide> {
  return {
    newId: options.newId ?? newSongSlideId,
    minSlides: options.minimum ?? 0,
    maxSlides: SONG_LIMITS.slides,
    fromLines: (lines, id) => ({id, lines}),
    toLines: slide => slide.lines,
    validate: slides => {
      const checked = checkPart(songSlidesSchema, slides);
      return checked.ok ? checked : {ok: false, error: 'invalid'};
    },
  };
}
