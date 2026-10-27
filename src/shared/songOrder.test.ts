import {describe, expect, it} from 'vitest';
import {parseSong} from './schema/song';
import {expandGroupSlidesWithLimit, playbackOrder} from './songOrder';
import {parseGroupedSong} from './schema/groupedSong';

const payload = {
  song: {
    format: 'llsong',
    schemaVersion: 1,
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Order fixture',
    slides: [{lines: ['First']}, {lines: ['Second']}],
    arrangements: [
      {name: 'repeat', slides: [2, 1, 2]},
      {name: 'empty', slides: []},
    ],
  },
  revision: 1,
  access: 'editable',
};

describe('shared playback order', () => {
  it('accepts exactly the tile limit and refuses a valid billion-slide expansion', () => {
    const id = '00000000-0000-4000-8000-000000000002';
    const source = {
      format: 'llsong',
      schemaVersion: 2,
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

  it.each([undefined, 'missing', 'empty'])('uses file order for %s', name => {
    const parsed = parseSong(
      JSON.stringify(payload.song),
      'legacy-order.llsong',
    );
    if (!parsed.ok) throw new Error('Invalid fixture');
    expect(playbackOrder(parsed.value.data, name)).toEqual([1, 2]);
    expect(playbackOrder(parsed.value.data, 'repeat')).toEqual([2, 1, 2]);
  });
  it('rejects an out-of-range reference at the document boundary', () => {
    expect(
      parseSong(
        JSON.stringify({
          ...payload.song,
          arrangements: [{name: 'invalid', slides: [3]}],
        }),
        'legacy-order.llsong',
      ).ok,
    ).toBe(false);
  });
});
