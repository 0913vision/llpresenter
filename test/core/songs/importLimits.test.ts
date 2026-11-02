import {describe, expect, it} from 'vitest';
import {limitReason} from '@core/common/limitReason';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import {importLimitReason} from '@core/songs/importLimits';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';

const GROUP = '11111111-1111-4111-a111-111111111111';

function songWith(
  slides: ReadonlyArray<{readonly lines: readonly string[]}>,
  picks = 0,
) {
  return sampleGroupedSong(
    [{id: GROUP, name: '1절', slides}],
    [{name: 'Order', groups: Array.from({length: picks}, () => GROUP)}],
  );
}

describe('importLimitReason', () => {
  it('accepts a song at the limits', () => {
    const slides = Array.from({length: SONG_IMPORT_LIMITS.slides}, () => ({
      lines: [],
    }));
    expect(
      importLimitReason(songWith(slides, SONG_IMPORT_LIMITS.picks)),
    ).toBeUndefined();
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
    [
      'order places',
      songWith([{lines: []}], SONG_IMPORT_LIMITS.picks + 1),
      limitReason('구성 순서', SONG_IMPORT_LIMITS.picks),
    ],
  ])('names the limit of %s', (_name, song, reason) => {
    expect(importLimitReason(song)).toBe(reason);
  });
});
