import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {describe, expect, it} from 'vitest';
import {parseContentEdit} from '@core/schema/contentEdit';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';

const id = '00000000-0000-4000-8000-000000000001';
const draft = {
  title: 'Invented import',
  slides: [
    {id: fixtureSlideId(1), lines: ['Invented line'], label: 'New label'},
  ],
};
const request = {type: 'song.import', draft, target: {kind: 'new'}};
const slidesOf = (count: number) =>
  Array.from({length: count}, (_, index) => ({
    id: fixtureSlideId(index + 1),
    lines: [],
  }));

describe('song.import contract', () => {
  it.each([{kind: 'new'}, {kind: 'overwrite', songId: id, baseRevision: 1}])(
    'accepts a bounded draft and target %o',
    target => {
      const edit = {...request, target};
      expect(parseContentEdit(edit)).toEqual({ok: true, value: edit});
    },
  );
  it.each([
    {title: ' '},
    {title: 'x'.repeat(513)},
    {slides: []},
    {slides: [{id: fixtureSlideId(1), lines: ['Line'], label: ' '}]},
    {slides: [{id: fixtureSlideId(1), lines: [3]}]},
    {slides: [{id: 'invalid', lines: []}]},
    {slides: [{id: fixtureSlideId(1), lines: [], label: 'x'.repeat(65)}]},
    {slides: [...draft.slides, ...draft.slides]},
    {slides: slidesOf(SONG_IMPORT_LIMITS.slides + 1)},
    {
      slides: [
        {id: fixtureSlideId(1), lines: Array.from({length: 20_001}, () => '')},
      ],
    },
    {slides: [{id: fixtureSlideId(1), lines: ['x'.repeat(1_500_001)]}]},
    {background: 'not-an-id'},
  ])('rejects malformed or excessive draft fields %j', fields => {
    expect(
      parseContentEdit({...request, draft: {...draft, ...fields}}).ok,
    ).toBe(false);
  });
  it.each([
    {kind: 'overwrite', songId: id},
    {kind: 'overwrite', songId: id, baseRevision: 0},
    {kind: 'overwrite', songId: 'bad', baseRevision: 1},
    {kind: 'other'},
  ])('rejects invalid target %o', target => {
    expect(parseContentEdit({...request, target}).ok).toBe(false);
  });
  it('accepts slide and line limits and retains safe extension fields', () => {
    for (const slides of [
      slidesOf(SONG_IMPORT_LIMITS.slides),
      [
        {
          id: fixtureSlideId(1),
          lines: Array.from({length: SONG_IMPORT_LIMITS.lines}, () => ''),
        },
      ],
      [{id: fixtureSlideId(1), lines: ['Line'], future: {kept: true}}],
    ]) {
      const edit = {...request, draft: {title: 'Limit', slides}};
      expect(parseContentEdit(edit)).toEqual({ok: true, value: edit});
    }
  });
});
