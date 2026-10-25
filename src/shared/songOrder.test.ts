import {describe, expect, it} from 'vitest';
import {parseSongDocument} from './schema/contentDocuments';
import {playbackOrder} from './songOrder';

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
  it.each([undefined, 'missing', 'empty'])('uses file order for %s', name => {
    const parsed = parseSongDocument(payload);
    if (!parsed.ok || parsed.value === null) throw new Error('Invalid fixture');
    expect(playbackOrder(parsed.value.song, name)).toEqual([1, 2]);
    expect(playbackOrder(parsed.value.song, 'repeat')).toEqual([2, 1, 2]);
  });
  it('rejects an out-of-range reference at the document boundary', () => {
    expect(
      parseSongDocument({
        ...payload,
        song: {...payload.song, arrangements: [{name: 'invalid', slides: [3]}]},
      }).ok,
    ).toBe(false);
  });
});
