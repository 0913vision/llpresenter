import {parseSong, type Song, type SongSlide} from '@core/schema/song';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {fixtureSlideId} from './slideFixtures';

export const SONG_SLIDES = [1, 2, 3].map(fixtureSlideId);

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
          {id: fixtureSlideId(1), label: '1절', lines, futureSlide: 1},
          {
            id: fixtureSlideId(2),
            label: '후렴',
            lines: ['second'],
            futureSlide: 2,
          },
          {id: fixtureSlideId(3), lines: ['third']},
        ],
      }),
      'memory.llsong',
    ),
  ).data;
}

export function sampleSong(
  slides: readonly SongSlide[] = [
    {id: fixtureSlideId(1), label: '1절', lines: ['first']},
    {id: fixtureSlideId(2), label: '1절', lines: ['second']},
    {id: fixtureSlideId(3), label: '후렴', lines: ['third']},
  ],
): Song {
  return {...song(), slides};
}
