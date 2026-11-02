import {describe, expect, it} from 'vitest';
import {
  expandGroupSlidesWithLimit,
  playbackGroupIds,
  playbackOrder,
} from '@core/songs/songOrder';
import type {GroupedSong} from '@core/schema/groupedSong';
import {createSongGroupId, createSongId} from '@core/schema/ids';
import {parseGroupedSong} from '@core/schema/groupedSong';

describe('shared playback order', () => {
  it('accepts exactly the tile limit and refuses a valid billion-slide expansion', () => {
    const id = '00000000-0000-4000-8000-000000000002';
    const source = {
      format: 'llsong',
      schemaVersion: 1,
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Invented',
      groups: [
        {
          id,
          name: 'Verse',
          slides: Array.from({length: 10_000}, () => ({lines: ['Invented']})),
        },
      ],
      arrangements: [
        {name: 'Large', groups: Array.from({length: 100_000}, () => id)},
      ],
    };
    const parsed = parseGroupedSong(JSON.stringify(source), 'invented.llsong');
    if (!parsed.ok) throw new Error(parsed.error.message);
    const song = parsed.value.data;
    const group = song.groups[0];
    if (group === undefined) throw new Error('Missing group');
    const normal = expandGroupSlidesWithLimit(song, [group.id]);
    expect(normal.capped).toBe(false);
    expect(normal.slides).toHaveLength(10_000);
    expect(normal.slides.at(-1)).toBe(10_000);
    const single = {
      ...song,
      groups: [{...group, slides: [{lines: ['Invented']}]}],
    };
    expect(
      expandGroupSlidesWithLimit(
        single,
        Array.from({length: 10_001}, () => group.id),
      ),
    ).toEqual({slides: [], capped: true});
    expect(
      expandGroupSlidesWithLimit(song, song.arrangements?.[0]?.groups ?? []),
    ).toEqual({slides: [], capped: true});
    expect(playbackOrder(song, 'Large')).toEqual([]);
  });
});

describe('playbackGroupIds', () => {
  const first = createSongGroupId('11111111-1111-4111-a111-111111111111');
  const second = createSongGroupId('22222222-2222-4222-a222-222222222222');
  const song: GroupedSong = {
    format: 'llsong',
    schemaVersion: 1,
    id: createSongId('6f1c2a9e-4b7d-4c1a-9e2f-0123456789a2'),
    title: '빈 구성 곡',
    groups: [
      {id: first, name: '1절', slides: [{lines: ['가사']}]},
      {id: second, name: '후렴', slides: [{lines: ['후렴']}]},
    ],
    arrangements: [
      {name: '반복', groups: [second, first, second]},
      {name: '빈구성', groups: []},
    ],
  };

  it('follows the named order', () => {
    expect(playbackGroupIds(song, '반복')).toEqual([second, first, second]);
  });

  it.each([undefined, '빈구성', '없는 구성'])(
    'uses the file order for the order %j',
    name => {
      expect(playbackGroupIds(song, name)).toEqual([first, second]);
    },
  );
});
