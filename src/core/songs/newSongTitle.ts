import {createSongSlideId} from '../schema/ids';
import type {Song, SongSlide} from '../schema/song';

/** Updates a title line only while it matches the previous song title. */
export function followTitle(
  slides: readonly SongSlide[],
  previous: string,
  next: string,
): readonly SongSlide[] {
  const first = slides[0];
  if (previous === next || !first?.titleSlide || first.lines[0] !== previous) {
    return slides;
  }
  return [
    {...first, lines: [next, ...first.lines.slice(1)]},
    ...slides.slice(1),
  ];
}

/** A new copy gets an opening title, while customized title slides stay intact. */
export function titleSlidesForCopy(
  song: Song,
  title: string,
  newId: () => string,
): readonly SongSlide[] {
  const first = song.slides[0];
  if (!first?.titleSlide) {
    return [
      {id: createSongSlideId(newId()), titleSlide: true, lines: [title]},
      ...song.slides,
    ];
  }
  return followTitle(song.slides, song.title, title);
}
