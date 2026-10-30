import {describe, expect, it} from 'vitest';
import {
  parseSongDragPayload,
  readSongDragData,
  serializeSongDragPayload,
  SONG_DRAG_MIME,
} from './songDrag';
import {expectSuccess} from './testHelpers';

const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';

describe('library song drag payload', () => {
  it('round-trips one song through the custom MIME JSON', () => {
    const payload = expectSuccess(
      parseSongDragPayload({kind: 'song', songId: SONG_ID}),
    );
    expect(SONG_DRAG_MIME).toBe('application/x-llp-song');
    const text = expectSuccess(serializeSongDragPayload(payload));
    expect(expectSuccess(readSongDragData(text))).toEqual(payload);
  });

  it('leaves insertion defaults and position to the receiving service', () => {
    expect(
      expectSuccess(
        parseSongDragPayload({
          kind: 'song',
          songId: SONG_ID,
          arrangement: 'other',
          index: 1,
          startMacro: 'other',
        }),
      ),
    ).toEqual({kind: 'song', songId: SONG_ID});
  });

  it.each([
    null,
    [],
    {},
    {kind: 'media', songId: SONG_ID},
    {kind: 'song', songId: 'song-1'},
    {kind: 'song', songIds: [SONG_ID]},
    {kind: 'song', songId: 1},
  ])('rejects malformed payload %j', value => {
    expect(parseSongDragPayload(value).ok).toBe(false);
  });

  it.each(['not json', '', 'null', '[]', '{"kind":"song"}'])(
    'rejects malformed drag JSON %j without throwing',
    text => {
      expect(readSongDragData(text).ok).toBe(false);
    },
  );
});
