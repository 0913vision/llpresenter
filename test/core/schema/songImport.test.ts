import {describe, expect, it} from 'vitest';
import {parseContentEdit} from '@core/schema/contentEdit';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';

const id = '00000000-0000-4000-8000-000000000001';
const group = '00000000-0000-4000-8000-000000000002';
const draft = {
  title: 'Invented import',
  groups: [
    {id: group, name: 'New label', slides: [{lines: ['Invented line']}]},
  ],
  arrangements: [{name: 'Sequence', groups: [group, group]}],
};
const request = {type: 'song.import', draft, target: {kind: 'new'}};

function groupOf(count: number, lines: readonly string[] = []) {
  return Array.from({length: count}, (_, index) => ({
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: '',
    slides: [{lines}],
  }));
}

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
    {groups: []},
    {groups: [{id: group, name: ' ', slides: [{lines: ['Line']}]}]},
    {groups: [{id: group, name: 'x', slides: []}]},
    {groups: [{id: group, name: 'x', slides: [{lines: [3]}]}]},
    {groups: [{id: 'bad', name: 'x', slides: [{lines: []}]}]},
    {background: 'not-an-id'},
    {arrangements: [{name: '기본', groups: [group]}]},
    {
      arrangements: [
        {name: 'Same', groups: [group]},
        {name: 'Same', groups: [group]},
      ],
    },
    {groups: groupOf(SONG_IMPORT_LIMITS.slides + 1)},
    {
      groups: [
        {
          id: group,
          name: 'x',
          slides: [{lines: Array.from({length: 20_001}, () => '')}],
        },
      ],
    },
    {
      groups: [
        {id: group, name: 'x', slides: [{lines: ['x'.repeat(1_500_001)]}]},
      ],
    },
    {title: 'x'.repeat(513)},
    {groups: [{id: group, name: 'x'.repeat(513), slides: [{lines: []}]}]},
    {arrangements: [{name: 'x'.repeat(513), groups: [group]}]},
    {
      arrangements: Array.from({length: 1001}, (_, index) => ({
        name: `Sequence ${index}`,
        groups: [],
      })),
    },
    {
      arrangements: [
        {
          name: 'Sequence',
          groups: Array.from(
            {length: SONG_IMPORT_LIMITS.picks + 1},
            () => group,
          ),
        },
      ],
    },
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
  it('accepts the slide and line limits and preserves safe nested extension fields', () => {
    for (const groups of [
      groupOf(SONG_IMPORT_LIMITS.slides),
      [
        {
          id: group,
          name: '',
          slides: [
            {lines: Array.from({length: SONG_IMPORT_LIMITS.lines}, () => '')},
          ],
        },
      ],
      [
        {
          id: group,
          name: '',
          slides: [{lines: ['Line'], future: {kept: true}}],
          future: {kept: true},
        },
      ],
    ]) {
      expect(
        parseContentEdit({...request, draft: {title: 'Limit', groups}}),
      ).toEqual({
        ok: true,
        value: {...request, draft: {title: 'Limit', groups}},
      });
    }
  });
});
