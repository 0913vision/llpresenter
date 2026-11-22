import {lyricsSlide} from '@fixtures/core/slides';
import {describe, expect, it} from 'vitest';
import {parseContentEdit} from '@core/schema/contentEdit';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';

const id = '00000000-0000-4000-8000-000000000001';
const draft = {
  title: 'Invented import',
  slides: [lyricsSlide(1, ['Invented line'], {label: 'New label'})],
};
const request = {type: 'song.import', draft, target: {kind: 'new'}};
const slidesOf = (count: number) =>
  Array.from({length: count}, (_, index) => lyricsSlide(index + 1, []));

describe('song.import contract', () => {
  it.each([{kind: 'new'}, {kind: 'overwrite', songId: id, baseRevision: 1}])(
    'accepts a bounded draft and target %o',
    target => {
      const edit = {...request, target};
      expect(parseContentEdit(edit)).toEqual({ok: true, value: edit});
    },
  );
  it.each([
    {kind: 'overwrite', songId: id},
    {kind: 'overwrite', songId: id, baseRevision: 0},
    {kind: 'overwrite', songId: 'bad', baseRevision: 1},
    {kind: 'other'},
  ])('rejects invalid target %o', target => {
    expect(parseContentEdit({...request, target}).ok).toBe(false);
  });
  it('accepts the most slides and the fields it does not know', () => {
    for (const slides of [
      slidesOf(SONG_IMPORT_LIMITS.slides),
      [{...lyricsSlide(1, 'Line'), future: {kept: true}}],
    ]) {
      const edit = {...request, draft: {title: 'Limit', slides}};
      expect(parseContentEdit(edit)).toEqual({ok: true, value: edit});
    }
    const slides = slidesOf(SONG_IMPORT_LIMITS.slides + 1);
    expect(
      parseContentEdit({...request, draft: {title: 'Limit', slides}}).ok,
    ).toBe(false);
  });

  it('refuses a draft over the character limit', () => {
    const line = 'x'.repeat(4000);
    const count = Math.ceil(SONG_IMPORT_LIMITS.characters / line.length);
    const slides = Array.from({length: count}, (_, index) =>
      lyricsSlide(index + 1, line),
    );
    expect(
      parseContentEdit({...request, draft: {title: 'Limit', slides}}).ok,
    ).toBe(false);
  });
});
