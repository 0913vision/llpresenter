import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {expect, it} from 'vitest';
import {parseSong} from '@core/schema/song';
import {createSongId, createSongSlideId} from '@core/schema/ids';
import {
  assignSlideHotKey,
  slideHotKeyView,
} from '@core/songs/slideHotKeyEditing';

const songId = createSongId('00000000-0000-4000-8000-000000000001');
const source = {songId, slideId: fixtureSlideId(3)};
function fixture() {
  const parsed = parseSong(
    JSON.stringify({
      format: 'llsong',
      schemaVersion: 1,
      id: songId,
      title: 'Invented song',
      slides: [
        {
          id: fixtureSlideId(1),
          lines: ['Invented first line'],
          hotKey: 'KeyA',
          label: '후렴',
        },
        {id: fixtureSlideId(2), lines: ['Invented second line'], label: '후렴'},
        {
          id: fixtureSlideId(3),
          lines: ['Invented third line'],
          future: {retained: true},
          label: '후렴',
        },
      ],
    }),
    'invented.llsong',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value.data;
}

it('edits the particular slide once and preserves identities and unknown fields', () => {
  const song = fixture();
  const view = slideHotKeyView(song, source);
  expect(view).toEqual({
    slideNumber: 3,
    value: undefined,
    otherAssignments: [{code: 'KeyA', slideNumber: 1}],
  });
  const changed = assignSlideHotKey(song, source, 'KeyC');
  if (!changed.ok) throw new Error(changed.error);
  expect(changed.value.slides[2]).toEqual({
    id: fixtureSlideId(3),
    label: '후렴',
    lines: ['Invented third line'],
    future: {retained: true},
    hotKey: 'KeyC',
  });
  expect(changed.value.slides[0]).toBe(song.slides[0]);
  expect(changed.value.slides[1]).toBe(song.slides[1]);
  expect(song.slides[2]?.hotKey).toBeUndefined();
  const unchanged = assignSlideHotKey(changed.value, source, 'KeyC');
  expect(unchanged.ok && unchanged.value === changed.value).toBe(true);
  const cleared = assignSlideHotKey(changed.value, source, undefined);
  if (!cleared.ok) throw new Error(cleared.error);
  expect(cleared.value).toEqual(song);
});

it('refuses duplicate/invalid assignments and mismatched or missing source identities', () => {
  const song = fixture();
  expect(assignSlideHotKey(song, source, 'KeyA')).toEqual({
    ok: false,
    error: 'duplicate-key',
  });
  expect(assignSlideHotKey(song, source, 'F1')).toEqual({
    ok: false,
    error: 'invalid-key',
  });
  expect(
    assignSlideHotKey(
      song,
      {...source, songId: createSongId('00000000-0000-4000-8000-000000000004')},
      'KeyC',
    ),
  ).toEqual({ok: false, error: 'missing-source'});
  expect(
    assignSlideHotKey(song, {...source, slideId: fixtureSlideId(9)}, 'KeyC'),
  ).toEqual({
    ok: false,
    error: 'missing-source',
  });
  expect(
    assignSlideHotKey(
      song,
      {
        ...source,
        slideId: createSongSlideId('00000000-0000-4000-8000-000000000004'),
      },
      'KeyC',
    ),
  ).toEqual({ok: false, error: 'missing-source'});
});

it.each(['', 'KeyAA', 'Digit10', 'Numpad1', 'ControlLeft', 'Keya'])(
  'refuses the invalid stored key %s without changing the song',
  code => {
    const song = fixture();
    expect(assignSlideHotKey(song, source, code)).toEqual({
      ok: false,
      error: 'invalid-key',
    });
    expect(song.slides[2]?.hotKey).toBeUndefined();
  },
);
