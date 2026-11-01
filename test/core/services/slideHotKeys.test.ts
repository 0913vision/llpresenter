import {describe, expect, it} from 'vitest';
import {findSlideHotKey} from '@core/services/slideHotKeys';
import {parseGroupedSong} from '@core/schema/groupedSong';
import type {ShowTile} from '@core/schema/showService';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const SONG = '00000000-0000-4000-8000-000000000001';
const FIRST = '00000000-0000-4000-8000-000000000002';
const SECOND = '00000000-0000-4000-8000-000000000003';

function tiles(): readonly ShowTile[] {
  const song = expectSuccess(
    parseGroupedSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 2,
        id: SONG,
        title: 'Invented song',
        groups: [
          {
            id: FIRST,
            name: 'Same',
            slides: [
              {lines: ['Invented one']},
              {lines: ['Invented two'], hotKey: 'KeyA'},
            ],
          },
          {
            id: SECOND,
            name: 'Same',
            slides: [{lines: ['Invented three'], hotKey: 'Digit0'}],
          },
        ],
        arrangements: [
          {name: 'Repeated', groups: [SECOND, FIRST, SECOND, FIRST]},
        ],
      }),
      'invented.llsong',
    ),
  ).data;
  const groups = new Map(song.groups.map(group => [group.id, group]));
  return (song.arrangements?.[0]?.groups ?? []).flatMap(groupId => {
    const group = groups.get(groupId);
    if (group === undefined) throw new Error('Missing invented group');
    return group.slides.map((slide, slideIndex) => ({
      label: group.name,
      labelColor: 'none' as const,
      lines: slide.lines,
      ...(slide.hotKey === undefined ? {} : {hotKey: slide.hotKey}),
      sourceSlide: {songId: song.id, groupId, slideIndex},
    }));
  });
}

describe('source-slide hot-key projection', () => {
  it('always resolves the first occurrence of the assigned source slide without cycling', () => {
    const input = tiles();
    for (let repeat = 0; repeat < 20; repeat += 1) {
      expect(findSlideHotKey(input, 'KeyA')).toEqual({
        tileIndex: 2,
        sourceSlide: {songId: SONG, groupId: FIRST, slideIndex: 1},
      });
      expect(findSlideHotKey(input, 'Digit0')).toEqual({
        tileIndex: 0,
        sourceSlide: {songId: SONG, groupId: SECOND, slideIndex: 0},
      });
    }
    expect(
      findSlideHotKey(
        input.filter(tile => tile.sourceSlide?.groupId === SECOND),
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
