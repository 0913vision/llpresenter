import {describe, expect, it} from 'vitest';
import {parseContentEdit} from './contentEdit';
import {SONG_IMPORT_LIMITS} from './songImport';

const id = '00000000-0000-4000-8000-000000000001';
const draft = {
  title: 'Invented import',
  slides: [{label: 'New label', lines: ['Invented line']}],
  arrangements: [{name: 'Sequence', slides: [1, 1]}],
};
const request = {type: 'song.import', draft, target: {kind: 'new'}};

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
    {slides: []},
    {slides: [{label: ' ', lines: ['Line']}]},
    {slides: [{lines: [3]}]},
    {background: 'not-an-id'},
    {arrangements: [{name: '기본', slides: [1]}]},
    {arrangements: [{name: 'Sequence', slides: [2]}]},
    {
      arrangements: [
        {name: 'Same', slides: [1]},
        {name: 'Same', slides: [1]},
      ],
    },
    {slides: Array.from({length: 5001}, () => ({lines: []}))},
    {slides: [{lines: Array.from({length: 20_001}, () => '')}]},
    {slides: [{lines: ['x'.repeat(1_000_001)]}]},
    {title: 'x'.repeat(513)},
    {slides: [{label: 'x'.repeat(513), lines: []}]},
    {arrangements: [{name: 'x'.repeat(513), slides: [1]}]},
    {
      arrangements: Array.from({length: 1001}, (_, index) => ({
        name: `Sequence ${index}`,
        slides: [],
      })),
    },
    {
      arrangements: [
        {name: 'Sequence', slides: Array.from({length: 20_001}, () => 1)},
      ],
    },
  ])('rejects malformed or excessive draft fields %o', fields => {
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
  it('accepts the slide and line limits and preserves safe nested extension fields', () => {
    for (const slides of [
      Array.from({length: SONG_IMPORT_LIMITS.slides}, () => ({lines: []})),
      [{lines: Array.from({length: SONG_IMPORT_LIMITS.lines}, () => '')}],
      [{label: '', lines: ['Line'], future: {kept: true}}],
    ]) {
      expect(
        parseContentEdit({...request, draft: {title: 'Limit', slides}}),
      ).toEqual({
        ok: true,
        value: {...request, draft: {title: 'Limit', slides}},
      });
    }
  });
});
