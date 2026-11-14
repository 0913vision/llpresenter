import type {SongSlide} from '../schema/song';
import {createSongSlideId} from '../schema/ids';
import type {TextImportDraft} from '../schema/textImport';

/** Assigns each imported slide its own identity and mapped header label. */
export function importSlides(
  slides: TextImportDraft['slides'],
  newId: () => string,
): readonly SongSlide[] {
  return slides.map(slide => ({
    id: createSongSlideId(newId()),
    lines: [...slide.lines],
    ...(slide.lyricFormat === undefined
      ? {}
      : {lyricFormat: slide.lyricFormat}),
    ...(slide.titleSlide === undefined ? {} : {titleSlide: slide.titleSlide}),
    ...(slide.titleLineCount === undefined
      ? {}
      : {titleLineCount: slide.titleLineCount}),
    ...(slide.label === undefined || slide.label.trim() === ''
      ? {}
      : {label: slide.label.trim()}),
  }));
}
