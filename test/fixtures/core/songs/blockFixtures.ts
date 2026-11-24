import type {Slide} from '@core/schema/slides/slide';
import {parseSong, type Song} from '@core/schema/songs/song';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {lyricsSlide} from '../slides';

export const SONG_SLIDES = [1, 2, 3].map(number => lyricsSlide(number, '').id);

export function song(
  lines: readonly string[] = ['first'],
  id = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
): Song {
  return expectSuccess(
    parseSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id,
        title: '새 아침',
        future: {kept: true},
        slides: [
          {...lyricsSlide(1, lines.join('\n'), {label: '1절'}), futureSlide: 1},
          {...lyricsSlide(2, 'second', {label: '후렴'}), futureSlide: 2},
          lyricsSlide(3, 'third'),
        ],
      }),
      'memory.llsong',
    ),
  ).data;
}

export function sampleSong(
  slides: readonly Slide[] = [
    lyricsSlide(1, 'first', {label: '1절'}),
    lyricsSlide(2, 'second', {label: '1절'}),
    lyricsSlide(3, 'third', {label: '후렴'}),
  ],
): Song {
  return {...song(), slides};
}
