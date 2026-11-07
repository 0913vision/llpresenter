import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {describe, expect, it} from 'vitest';
import {findSlideHotKey} from '@core/services/slideHotKeys';
import {parseSong} from '@core/schema/song';
import type {ShowTile} from '@core/schema/showService';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const SONG = '00000000-0000-4000-8000-000000000001';

function tiles(): readonly ShowTile[] {
  const song = expectSuccess(
    parseSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id: SONG,
        title: 'Invented song',
        slides: [
          {id: fixtureSlideId(1), lines: ['Invented one'], label: 'Same'},
          {
            id: fixtureSlideId(2),
            lines: ['Invented two'],
            hotKey: 'KeyA',
            label: 'Same',
          },
          {
            id: fixtureSlideId(3),
            lines: ['Invented three'],
            hotKey: 'Digit0',
            label: 'Same',
          },
        ],
      }),
      'invented.llsong',
    ),
  ).data;
  return song.slides.map(slide => ({
    label: slide.label ?? null,
    labelColor: 'none',
    lines: slide.lines,
    ...(slide.hotKey === undefined ? {} : {hotKey: slide.hotKey}),
    sourceSlide: {songId: song.id, slideId: slide.id},
  }));
}

describe('source-slide hot-key projection', () => {
  it('always resolves the first occurrence of the assigned source slide without cycling', () => {
    const input = tiles();
    for (let repeat = 0; repeat < 20; repeat += 1) {
      expect(findSlideHotKey(input, 'KeyA')).toEqual({
        tileIndex: 1,
        sourceSlide: {songId: SONG, slideId: fixtureSlideId(2)},
      });
      expect(findSlideHotKey(input, 'Digit0')).toEqual({
        tileIndex: 2,
        sourceSlide: {songId: SONG, slideId: fixtureSlideId(3)},
      });
    }
    expect(
      findSlideHotKey(
        input.filter(tile => tile.sourceSlide?.slideId === fixtureSlideId(3)),
        'KeyA',
      ),
    ).toBeNull();
    for (const code of ['KeyZ', 'a', 'Numpad0', '']) {
      expect(findSlideHotKey(input, code)).toBeNull();
    }
  });

  it('finds no hot key on a tile without a source slide', () => {
    expect(findSlideHotKey([{hotKey: 'KeyA'}], 'KeyA')).toBeNull();
  });
});
