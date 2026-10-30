import {describe, expect, it} from 'vitest';
import {findSlideHotKey} from './slideHotKeys';
import {parseGroupedSong} from '../schema/groupedSong';
import {parseShowService, type ShowTile} from '../schema/showService';
import {parseShowLibrarySong} from '../schema/showLibrarySong';
import {expectSuccess} from '../schema/testHelpers';

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

function service(input: unknown) {
  return parseShowService({
    revision: 1,
    id: 'invented-service',
    name: 'Invented service',
    readOnly: false,
    rows: [],
    tiles: {item: input},
    jumpKeys: {},
  });
}

describe('source-slide hot-key projection', () => {
  it('keeps exact source identity through service and library projection validation', () => {
    const input = tiles();
    expect(expectSuccess(service(input))?.tiles['item']).toEqual(input);
    expect(
      expectSuccess(
        parseShowLibrarySong({
          songId: SONG,
          songRevision: 1,
          title: 'Invented song',
          readOnly: false,
          tiles: input,
          jumpKeys: {},
        }),
      )?.tiles,
    ).toEqual(input);
    expect(input[2]?.sourceSlide).toEqual({
      songId: SONG,
      groupId: FIRST,
      slideIndex: 1,
    });
    expect(input[5]?.sourceSlide).toEqual(input[2]?.sourceSlide);
  });

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

  it('accepts legacy tiles without metadata and unassigned grouped tiles', () => {
    expectSuccess(service([{label: null, labelColor: 'none', lines: []}]));
    expectSuccess(
      service([
        {
          label: null,
          labelColor: 'none',
          lines: [],
          sourceSlide: {songId: SONG, groupId: FIRST, slideIndex: 0},
        },
      ]),
    );
    expect(findSlideHotKey([{hotKey: 'KeyA'}], 'KeyA')).toBeNull();
  });

  it.each([
    {hotKey: 'KeyA'},
    {
      hotKey: 'Numpad0',
      sourceSlide: {songId: SONG, groupId: FIRST, slideIndex: 0},
    },
    {hotKey: null},
    {sourceSlide: {songId: SONG, groupId: FIRST, slideIndex: -1}},
    {sourceSlide: {songId: SONG, groupId: FIRST, slideIndex: 0.5}},
    {sourceSlide: {songId: 'invalid', groupId: FIRST, slideIndex: 0}},
    {sourceSlide: {songId: SONG, groupId: 'invalid', slideIndex: 0}},
  ])('rejects malformed metadata %j', metadata => {
    expect(
      service([{label: null, labelColor: 'none', lines: [], ...metadata}]).ok,
    ).toBe(false);
  });
});
