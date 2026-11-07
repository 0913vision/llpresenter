import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {describe, expect, it} from 'vitest';
import {limitReason} from '@core/common/limitReason';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import {importLimitReason} from '@core/songs/importLimits';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';

function songWith(slides: ReadonlyArray<{readonly lines: readonly string[]}>) {
  return sampleSong(
    slides.map((slide, index) => ({...slide, id: fixtureSlideId(index + 1)})),
  );
}

describe('importLimitReason', () => {
  it('accepts the exact serialized import character limit and refuses one character more', () => {
    const base = songWith([{lines: ['']}]);
    const padding =
      SONG_IMPORT_LIMITS.characters -
      JSON.stringify({
        title: base.title,
        slides: base.slides,
      }).length;
    const withCharacters = (extra: number) => ({
      ...base,
      slides: base.slides.map(slide => ({
        ...slide,
        lines: ['x'.repeat(padding + extra)],
      })),
    });
    expect(importLimitReason(withCharacters(0))).toBeUndefined();
    expect(importLimitReason(withCharacters(1))).toBe(
      limitReason('글자', SONG_IMPORT_LIMITS.characters),
    );
  });

  it('accepts a song at the limits', () => {
    const slides = Array.from({length: SONG_IMPORT_LIMITS.slides}, () => ({
      lines: [],
    }));
    expect(importLimitReason(songWith(slides))).toBeUndefined();
  });

  it.each([
    [
      'slides',
      songWith(
        Array.from({length: SONG_IMPORT_LIMITS.slides + 1}, () => ({
          lines: [],
        })),
      ),
      limitReason('슬라이드', SONG_IMPORT_LIMITS.slides),
    ],
    [
      'lines',
      songWith([
        {lines: Array.from({length: SONG_IMPORT_LIMITS.lines + 1}, () => '')},
      ]),
      limitReason('줄', SONG_IMPORT_LIMITS.lines),
    ],
  ])('names the limit of %s', (_name, song, reason) => {
    expect(importLimitReason(song)).toBe(reason);
  });
});
