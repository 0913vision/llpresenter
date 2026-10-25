import {describe, expect, it} from 'vitest';
import {createSongId} from './ids';
import {
  parseShowLibrarySong,
  parseShowLibrarySongReply,
  parseShowLibrarySongRequest,
  SHOW_LIBRARY_SONG_LIMITS,
} from './showLibrarySong';

const songId = createSongId('10000000-0000-4000-8000-000000000001');
const tile = {label: null, labelColor: 'none', lines: ['Invented lyric']};
const shown = {
  songId,
  songRevision: 1,
  title: 'Invented song',
  readOnly: false,
  tiles: [tile],
  jumpKeys: {Digit1: 'Verse'},
};

describe('standalone library song boundary', () => {
  it('accepts a request, nullable reply, and a bounded projection', () => {
    expect(parseShowLibrarySongRequest({songId, ignored: true})).toEqual({
      ok: true,
      value: {songId},
    });
    expect(parseShowLibrarySong(null)).toEqual({ok: true, value: null});
    expect(parseShowLibrarySongReply(songId, shown)).toEqual({
      ok: true,
      value: shown,
    });
    expect(
      parseShowLibrarySong({...shown, readOnly: true, problem: 'newer-version'})
        .ok,
    ).toBe(true);
    expect(
      parseShowLibrarySong({...shown, problem: 'missing-background'}).ok,
    ).toBe(true);
  });

  it.each([
    {...shown, songId: 'invalid'},
    {...shown, songRevision: 0},
    {...shown, readOnly: 'yes'},
    {...shown, problem: 'missing-song'},
    {...shown, background: {mediaId: '', loop: true}},
    {...shown, tiles: [{...tile, lines: [1]}]},
    {
      ...shown,
      tiles: Array.from(
        {length: SHOW_LIBRARY_SONG_LIMITS.tiles + 1},
        () => tile,
      ),
    },
    {
      ...shown,
      tiles: [
        {
          ...tile,
          lines: Array.from(
            {length: SHOW_LIBRARY_SONG_LIMITS.linesPerTile + 1},
            () => '',
          ),
        },
      ],
    },
    {
      ...shown,
      jumpKeys: Object.fromEntries(
        Array.from({length: SHOW_LIBRARY_SONG_LIMITS.jumpKeys + 1}, (_, i) => [
          String(i),
          'Label',
        ]),
      ),
    },
  ])('rejects malformed or oversized replies %#', value => {
    expect(parseShowLibrarySong(value).ok).toBe(false);
  });

  it('rejects malformed requests and mismatched reply identities', () => {
    expect(parseShowLibrarySongRequest({songId: 'invalid'}).ok).toBe(false);
    expect(parseShowLibrarySongRequest([]).ok).toBe(false);
    expect(
      parseShowLibrarySongReply(songId, {
        ...shown,
        songId: '10000000-0000-4000-8000-000000000002',
      }).ok,
    ).toBe(false);
  });
});
