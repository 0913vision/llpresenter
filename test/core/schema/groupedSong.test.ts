import {describe, expect, it} from 'vitest';
import {
  arrangementGroupIds,
  parseGroupedSong,
  serializeGroupedSong,
  SONG_GROUP_LIMITS,
  type GroupedSong,
} from '@core/schema/groupedSong';
import {expectFailure, expectSuccess} from '@fixtures/core/schema/testHelpers';

const FILE = 'invented.llsong';
const SONG_ID = '00000000-0000-4000-8000-000000000001';
const GROUP_A = '00000000-0000-4000-8000-000000000002';
const GROUP_B = '00000000-0000-4000-8000-000000000003';

function grouped() {
  return {
    format: 'llsong',
    schemaVersion: 1,
    id: SONG_ID,
    title: 'Invented song',
    groups: [
      {id: GROUP_A, name: '1절', slides: [{lines: ['Invented first line']}]},
      {id: GROUP_B, name: '후렴', slides: [{lines: []}]},
    ],
    arrangements: [{name: 'Alternate', groups: [GROUP_B, GROUP_A, GROUP_B]}],
  };
}

function parse(value: unknown) {
  return parseGroupedSong(JSON.stringify(value), FILE);
}

describe('grouped song contract', () => {
  it('round trips repeated groups, blank slides and unknown nested fields', () => {
    const source = grouped();
    const input = {
      ...source,
      score: {invented: true},
      groups: source.groups.map(group => ({
        ...group,
        extra: {enabled: false},
        slides: group.slides.map(slide => ({
          ...slide,
          notes: {invented: 'note'},
        })),
      })),
      arrangements: source.arrangements.map(arrangement => ({
        ...arrangement,
        extra: [1],
      })),
    };
    const loaded = expectSuccess(parse(input));
    expect(loaded).toMatchObject({
      data: input,
      sourceVersion: 1,
      access: 'editable',
    });
    const text = expectSuccess(serializeGroupedSong(loaded.data, FILE));
    expect(JSON.parse(text)).toEqual(input);
    expect(expectSuccess(parseGroupedSong(text, FILE)).data).toEqual(input);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('allows duplicate names, unnamed groups and empty arrangements', () => {
    const source = grouped();
    expectSuccess(
      parse({
        ...source,
        groups: source.groups.map(group => ({...group, name: ''})),
        arrangements: [{name: 'Empty', groups: []}],
      }),
    );
    expectSuccess(
      parse({
        ...source,
        groups: source.groups.map(group => ({...group, name: 'Same'})),
      }),
    );
  });

  it.each([
    ['empty master', {...grouped(), groups: []}],
    [
      'empty group',
      {...grouped(), groups: [{...grouped().groups[0], slides: []}]},
    ],
    [
      'bad group id',
      {...grouped(), groups: [{...grouped().groups[0], id: 'invalid'}]},
    ],
    [
      'duplicate group id',
      {...grouped(), groups: [grouped().groups[0], grouped().groups[0]]},
    ],
    [
      'missing group',
      {...grouped(), arrangements: [{name: 'Missing', groups: [SONG_ID]}]},
    ],
    [
      'reserved name',
      {...grouped(), arrangements: [{name: '기본', groups: []}]},
    ],
    [
      'duplicate arrangement',
      {
        ...grouped(),
        arrangements: [grouped().arrangements[0], grouped().arrangements[0]],
      },
    ],
    [
      'missing lines',
      {...grouped(), groups: [{id: GROUP_A, name: 'Verse', slides: [{}]}]},
    ],
  ])('rejects %s', (_name, value) => {
    expectFailure(parse(value));
  });

  it('identifies the repeated grouped arrangement at its original index', () => {
    const source = grouped();
    const repeated = {
      ...source,
      arrangements: [source.arrangements[0], source.arrangements[0]],
    };
    expect(expectFailure(parse(repeated))).toMatchObject({
      kind: 'invalid',
      field: 'arrangements.1',
      message: 'Another arrangement already has this name',
    });
  });

  it('bounds total slides and occurrences across groups and arrangements', () => {
    const source = grouped();
    expectFailure(
      parse({
        ...source,
        groups: source.groups.map(group => ({
          ...group,
          slides: Array.from(
            {length: SONG_GROUP_LIMITS.slides / 2 + 1},
            () => ({lines: []}),
          ),
        })),
      }),
    );
    expectFailure(
      parse({
        ...source,
        arrangements: ['One', 'Two'].map(name => ({
          name,
          groups: Array.from(
            {length: SONG_GROUP_LIMITS.occurrences / 2 + 1},
            () => GROUP_A,
          ),
        })),
      }),
    );
    expectFailure(
      parse({
        ...source,
        arrangements: Array.from(
          {length: SONG_GROUP_LIMITS.arrangements + 1},
          (_, index) => ({name: String(index), groups: []}),
        ),
      }),
    );
  });

  it('opens compatible future versions read-only and refuses writing them', () => {
    const loaded = expectSuccess(parse({...grouped(), schemaVersion: 2}));
    expect(loaded.access).toBe('readOnly');
    expect(expectFailure(serializeGroupedSong(loaded.data, FILE)).kind).toBe(
      'newer',
    );
  });
});

describe('grouped song arrangements', () => {
  it('resolves arrangement group IDs falling back to all groups', () => {
    const v2 = expectSuccess(parse(grouped())).data;
    const allIds = v2.groups.map(group => group.id);
    expect(arrangementGroupIds(v2, undefined)).toEqual(allIds);
    expect(arrangementGroupIds(v2, 'nonexistent')).toEqual(allIds);
    expect(arrangementGroupIds(v2, 'Alternate')).toEqual(
      v2.arrangements?.[0]?.groups,
    );

    const withEmpty: GroupedSong = {
      ...v2,
      arrangements: [{name: 'Empty', groups: []}],
    };
    expect(arrangementGroupIds(withEmpty, 'Empty')).toEqual([]);
  });
});
