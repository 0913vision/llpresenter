import {describe, expect, it} from 'vitest';
import {limitReason} from '@core/common/limitReason';
import {SONG_IMPORT_LIMITS} from '@core/schema/songs/songImport';
import {importLimitReason} from '@core/songs/importLimits';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';
import {lyricsSlide} from '@fixtures/core/slides';

function songOf(count: number, text = '') {
  return sampleSong(
    Array.from({length: count}, (_, index) => lyricsSlide(index + 1, text)),
  );
}

describe('importLimitReason', () => {
  it('accepts the exact number of characters and refuses one more', () => {
    const {title, slides} = songOf(1, 'x');
    const padding =
      SONG_IMPORT_LIMITS.characters -
      JSON.stringify({title, slides}).length +
      1;
    expect(importLimitReason(songOf(1, 'x'.repeat(padding)))).toBeUndefined();
    expect(importLimitReason(songOf(1, 'x'.repeat(padding + 1)))).toBe(
      limitReason('글자', SONG_IMPORT_LIMITS.characters),
    );
  });

  it('accepts the most slides and refuses one more', () => {
    expect(
      importLimitReason(songOf(SONG_IMPORT_LIMITS.slides)),
    ).toBeUndefined();
    expect(importLimitReason(songOf(SONG_IMPORT_LIMITS.slides + 1))).toBe(
      limitReason('슬라이드', SONG_IMPORT_LIMITS.slides),
    );
  });
});
