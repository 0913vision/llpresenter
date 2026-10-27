import {describe, expect, it} from 'vitest';
import {
  arrangementGroupIds,
  isGroupedSong,
  parseGroupedSong,
  parseGroupedSongDraft,
  serializeGroupedSong,
  SONG_GROUP_LIMITS,
  type GroupedSong,
} from './groupedSong';
import {parseSong} from './song';
import {expectFailure, expectSuccess} from './testHelpers';

const FILE = 'invented.llsong';
const SONG_ID = '00000000-0000-4000-8000-000000000001';
const GROUP_A = '00000000-0000-4000-8000-000000000002';
const GROUP_B = '00000000-0000-4000-8000-000000000003';

function legacy() {
  return {
    format: 'llsong',
    schemaVersion: 1,
    id: SONG_ID,
    title: 'Invented song',
    slides: [
      {label: '1절', lines: ['Invented first line']},
      {label: '1절', lines: ['Invented second line']},
      {label: '후렴', lines: ['Invented third line']},
      {label: '후렴', lines: ['Invented fourth line']},
    ],
    arrangements: [{name: 'Alternate', slides: [1, 2, 3, 4, 3, 4]}],
  };
}

function grouped() {
  return {
    format: 'llsong',
    schemaVersion: 2,
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

function expansion(song: GroupedSong, index: number): readonly string[][] {
  const ids = song.arrangements?.[index]?.groups;
  const selected =
    ids === undefined || ids.length === 0
      ? song.groups
      : ids.map(id => {
          const group = song.groups.find(item => item.id === id);
          if (group === undefined) throw new Error('Missing migrated group');
          return group;
        });
  return selected.flatMap(group => group.slides.map(slide => [...slide.lines]));
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
      sourceVersion: 2,
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
    const loaded = expectSuccess(parse({...grouped(), schemaVersion: 3}));
    expect(loaded.access).toBe('readOnly');
    expect(expectFailure(serializeGroupedSong(loaded.data, FILE)).kind).toBe(
      'newer',
    );
  });
});

describe('version 1 group migration', () => {
  it('keeps label changes when adjacent slides carry the same section number', () => {
    const song = expectSuccess(
      parse({
        ...legacy(),
        slides: [
          {label: 'Verse', lines: ['Invented verse'], section: 0},
          {label: 'Chorus', lines: ['Invented chorus'], section: 0},
        ],
        arrangements: [],
      }),
    ).data;
    expect(song.groups.map(group => group.name)).toEqual(['Verse', 'Chorus']);
  });

  it('splits one run only at the boundaries a partial arrangement needs', () => {
    const source = legacy();
    const input = {
      ...source,
      slides: source.slides
        .slice(0, 3)
        .map(slide => ({...slide, label: '1절'})),
      arrangements: [{name: 'Partial', slides: [3, 1, 2]}],
    };
    const song = expectSuccess(parse(input)).data;
    expect(song.groups.map(group => group.slides.length)).toEqual([2, 1]);
    expect(expansion(song, 0)).toEqual(
      [3, 1, 2].map(number => input.slides[number - 1]?.lines),
    );
  });

  it('keeps optional fields absent and unrelated legacyV1 data at its own path', () => {
    const {arrangements: _arrangements, ...source} = legacy();
    const song = expectSuccess(
      parse({...source, legacyV1: {invented: true}}),
    ).data;
    expect(song).not.toHaveProperty('arrangements');
    expect(song).toHaveProperty('legacyV1', {invented: true});
    expect(song.groups.map(group => group.slides.length)).toEqual([2, 2]);
  });

  it('converts contiguous runs and keeps repeated whole-group occurrences', () => {
    const input = legacy();
    const before = JSON.stringify(input);
    const loaded = expectSuccess(parse(input));
    expect(loaded.sourceVersion).toBe(1);
    expect(loaded.data.schemaVersion).toBe(2);
    expect(
      loaded.data.groups.map(group => [group.name, group.slides.length]),
    ).toEqual([
      ['1절', 2],
      ['후렴', 2],
    ]);
    const [a, b] = loaded.data.groups;
    expect(loaded.data.arrangements?.[0]?.groups).toEqual([
      a?.id,
      b?.id,
      b?.id,
    ]);
    expect(expansion(loaded.data, 0)).toEqual(
      [1, 2, 3, 4, 3, 4].map(number => input.slides[number - 1]?.lines),
    );
    const text = expectSuccess(serializeGroupedSong(loaded.data, FILE));
    expect(JSON.parse(text)).not.toHaveProperty('slides');
    expect(loaded.data.arrangements?.[0]).not.toHaveProperty('slides');
    expect(JSON.stringify(input)).toBe(before);
    expect(expectSuccess(parseGroupedSong(text, FILE)).data).toEqual(
      loaded.data,
    );
  });

  it('unions cuts across arrangements, including reversed and repeated partial runs', () => {
    const input = {
      ...legacy(),
      arrangements: [
        {name: 'Reverse', slides: [2, 1, 3, 4]},
        {name: 'Repeat', slides: [1, 2, 2, 3]},
        {name: 'Empty', slides: []},
      ],
    };
    const song = expectSuccess(parse(input)).data;
    expect(song.groups.map(group => group.slides.length)).toEqual([1, 1, 1, 1]);
    input.arrangements.forEach((arrangement, index) => {
      const order = arrangement.slides.length
        ? arrangement.slides
        : [1, 2, 3, 4];
      expect(expansion(song, index)).toEqual(
        order.map(number => input.slides[number - 1]?.lines),
      );
    });
  });

  it('treats missing and empty labels as one unnamed run without joining nonadjacent runs', () => {
    const source = legacy();
    const song = expectSuccess(
      parse({
        ...source,
        arrangements: [],
        slides: [
          {lines: []},
          {label: '', lines: ['Invented blank label']},
          {label: '1절', lines: []},
          {lines: []},
        ],
      }),
    ).data;
    expect(song.groups.map(group => [group.name, group.slides.length])).toEqual(
      [
        ['', 2],
        ['1절', 1],
        ['', 1],
      ],
    );
    expect(new Set(song.groups.map(group => group.id)).size).toBe(3);
  });

  it('splits import draft slides with identical names when explicit sections differ', () => {
    const source = legacy();
    const song = expectSuccess(
      parseGroupedSongDraft(
        JSON.stringify({
          ...source,
          arrangements: [],
          slides: [
            {label: '후렴', lines: ['Chorus A'], section: 0},
            {label: '후렴', lines: ['Chorus B'], section: 1},
          ],
        }),
        FILE,
      ),
    ).data;
    expect(song.groups.map(group => [group.name, group.slides.length])).toEqual(
      [
        ['후렴', 1],
        ['후렴', 1],
      ],
    );
    expect(song.groups[0]?.slides[0]?.lines).toEqual(['Chorus A']);
    expect(song.groups[1]?.slides[0]?.lines).toEqual(['Chorus B']);
    expect(song.groups[0]?.id).not.toBe(song.groups[1]?.id);
  });

  it.each(['intro', 3, {annotation: 'legacy'}])(
    'preserves a file section extension without treating it as a boundary: %j',
    section => {
      const song = expectSuccess(
        parse({
          ...legacy(),
          arrangements: [],
          slides: [
            {label: 'Verse', lines: ['Invented first'], section},
            {label: 'Verse', lines: ['Invented second'], section: 7},
          ],
        }),
      ).data;
      expect(song.groups).toHaveLength(1);
      expect(song.groups[0]?.slides).toEqual([
        {lines: ['Invented first'], section},
        {lines: ['Invented second'], section: 7},
      ]);
      expect(
        expectSuccess(
          parseGroupedSong(
            expectSuccess(serializeGroupedSong(song, FILE)),
            FILE,
          ),
        ).data,
      ).toEqual(song);
    },
  );

  it('splits import draft groups on label changes even with equal section indices', () => {
    const song = expectSuccess(
      parseGroupedSongDraft(
        JSON.stringify({
          ...legacy(),
          arrangements: [],
          slides: [
            {label: 'Verse', lines: ['Invented first'], section: 0},
            {label: 'Chorus', lines: ['Invented second'], section: 0},
          ],
        }),
        FILE,
      ),
    ).data;
    expect(song.groups.map(group => group.name)).toEqual(['Verse', 'Chorus']);
    expect(song.groups.flatMap(group => group.slides)).toEqual([
      {lines: ['Invented first']},
      {lines: ['Invented second']},
    ]);
  });

  it('preserves unknown fields and archives promoted-key collisions without overwriting data', () => {
    const source = legacy();
    const input = {
      ...source,
      groups: {old: true},
      legacyV1: ['original'],
      extra: {value: 1},
      slides: source.slides.map(slide => ({
        ...slide,
        notes: {invented: true},
      })),
      arrangements: source.arrangements.map(arrangement => ({
        ...arrangement,
        groups: ['old'],
        legacyV1: null,
        extra: false,
      })),
    };
    Object.defineProperty(input, '__proto__', {
      value: {invented: true},
      enumerable: true,
    });
    Object.defineProperty(input.slides[0] ?? {}, 'constructor', {
      value: {invented: 'slide'},
      enumerable: true,
    });
    Object.defineProperty(input.arrangements[0] ?? {}, 'prototype', {
      value: ['invented'],
      enumerable: true,
    });
    const song = expectSuccess(parse(input)).data;
    const text = expectSuccess(serializeGroupedSong(song, FILE));
    const saved: unknown = JSON.parse(text);
    expect(saved).toHaveProperty('legacyV1', {
      groups: {old: true},
      legacyV1: ['original'],
    });
    expect(saved).toHaveProperty(
      'arrangements.0',
      expect.objectContaining({
        legacyV1: {groups: ['old'], legacyV1: null},
        extra: false,
        prototype: ['invented'],
      }),
    );
    expect(saved).toHaveProperty('__proto__', {invented: true});
    const reloaded = expectSuccess(parseGroupedSong(text, FILE)).data;
    expect(
      Object.getOwnPropertyDescriptor(
        reloaded.groups[0]?.slides[0] ?? {},
        'constructor',
      )?.value,
    ).toEqual({invented: 'slide'});
    expect(song.groups.flatMap(group => group.slides)).toEqual(
      input.slides.map(({label: _label, ...slide}) => slide),
    );
    expect(saved).toHaveProperty('extra', input.extra);
  });

  it.each([0, -1, 1.5, 5, '1', null])(
    'rejects invalid legacy reference %s before conversion',
    number => {
      expectFailure(
        parse({
          ...legacy(),
          arrangements: [{name: 'Invalid', slides: [number]}],
        }),
      );
    },
  );

  it('preserves all four-slide sequences through length four, with cuts from a second arrangement', () => {
    const source = legacy();
    for (let length = 0; length <= 4; length += 1) {
      for (let code = 0; code < 4 ** length; code += 1) {
        const order = Array.from(
          {length},
          (_, index) => (Math.floor(code / 4 ** index) % 4) + 1,
        );
        const input = {
          ...source,
          arrangements: [
            {name: 'First', slides: order},
            {name: 'Second', slides: [3, 4, 1, 2]},
          ],
        };
        const song = expectSuccess(parse(input)).data;
        input.arrangements.forEach((arrangement, index) => {
          const expected = arrangement.slides.length
            ? arrangement.slides
            : [1, 2, 3, 4];
          expect(expansion(song, index)).toEqual(
            expected.map(number => source.slides[number - 1]?.lines),
          );
        });
        expect(expansion(song, -1)).toEqual(
          source.slides.map(slide => slide.lines),
        );
      }
    }
  });

  it('leaves the active version 1 codec unchanged during consumer rollout', () => {
    const input = legacy();
    const old = expectSuccess(parseSong(JSON.stringify(input), FILE));
    expect(old.data).toEqual(input);
    expect(old.data.schemaVersion).toBe(1);
    expectFailure(
      serializeGroupedSong(
        {...expectSuccess(parse(input)).data, schemaVersion: 1},
        FILE,
      ),
    );
  });

  it('distinguishes grouped songs from legacy v1 songs', () => {
    const v1 = expectSuccess(parseSong(JSON.stringify(legacy()), FILE)).data;
    const v2 = expectSuccess(parse(legacy())).data;
    expect(isGroupedSong(v1)).toBe(false);
    expect(isGroupedSong(v2)).toBe(true);
  });

  it('resolves arrangement group IDs falling back to all groups', () => {
    const v2 = expectSuccess(parse(legacy())).data;
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
