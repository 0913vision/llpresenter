import {describe, expect, it} from 'vitest';
import {
  parseGroupedSong,
  serializeGroupedSong,
  type GroupedSong,
} from '@core/schema/groupedSong';
import {createSongGroupId} from '@core/schema/ids';
import {parseSong, serializeSong} from '@core/schema/song';
import {expectSuccess} from '@core/schema/testHelpers';
import {
  blockSnapshot,
  editBlocks,
  linearBlockAddress,
  linearSlidesOf,
  slideCountOf,
  type BlockCommand,
} from '@core/songs/blockEdits';
import {SongHistory} from '@core/songs/songHistory';

function song(
  lines: readonly string[] = ['first'],
  id = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
) {
  return expectSuccess(
    parseSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id,
        title: '새 아침',
        future: {kept: true},
        slides: [
          {label: '1절', lines, futureSlide: 1},
          {label: '후렴', lines: ['second'], futureSlide: 2},
          {lines: ['third']},
        ],
        arrangements: [
          {name: '주일용', slides: [3, 2, 1, 2], futureArrangement: true},
          {name: '짧게', slides: [2]},
          {name: '빈 구성', slides: []},
        ],
      }),
      'memory.llsong',
    ),
  ).data;
}

describe('song block edits', () => {
  it.each(
    [
      [],
      [''],
      ['first', '', 'last'],
      ['', 'last'],
      ['first', ''],
      ['first', '  ', 'last'],
    ].map(lines => ({lines})),
  )(
    'splits on an empty line in %j and keeps every arrangement reference',
    ({lines}) => {
      const original = song(lines);
      const start = lines[0] === 'first' ? 6 : 0;
      const next = editBlocks(
        blockSnapshot(original, {block: 0, start, end: start}),
        {type: 'enter'},
      );
      expect(next.song.slides).toHaveLength(4);
      expect(next.song.arrangements?.map(item => item.slides)).toEqual([
        [4, 3, 1, 2, 3],
        [3],
        [],
      ]);
      expect(next.song.slides[2]).toBe(original.slides[1]);
      expect(next.song.slides[3]).toBe(original.slides[2]);
      expect(next.song.slides[0]).toMatchObject({label: '1절', futureSlide: 1});
      expect(next.song.slides[1]).not.toHaveProperty('label');
      expect(serializeSong(next.song, 'memory.llsong').ok).toBe(true);
      expect(original.slides).toHaveLength(3);
    },
  );

  it('removes the separating empty line without losing surrounding text', () => {
    const next = editBlocks(
      blockSnapshot(song(['first', '', 'last']), {block: 0, start: 6, end: 6}),
      {type: 'enter'},
    );
    expect(next.song.slides.slice(0, 2).map(item => item.lines)).toEqual([
      ['first'],
      ['last'],
    ]);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
  });

  it('ordinary Enter stays in the block and preserves arrangement objects', () => {
    const original = song(['first']);
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 2, end: 4}),
      {type: 'enter'},
    );
    expect(next.song.slides[0]?.lines).toEqual(['fi', 't']);
    expect(next.song.arrangements).toBe(original.arrangements);
  });

  it('splits at a selection and replaces its selected text', () => {
    const next = editBlocks(
      blockSnapshot(song(['abCDxy']), {block: 0, start: 2, end: 4}),
      {type: 'split'},
    );
    expect(next.song.slides.slice(0, 2).map(item => item.lines)).toEqual([
      ['ab'],
      ['xy'],
    ]);
  });

  it.each([0, 2])('inserts an empty block after block %i', block => {
    const original = song();
    const next = editBlocks(
      blockSnapshot(original, {block, start: 0, end: 0}),
      {type: 'insert'},
    );
    expect(next.song.slides[block + 1]).toEqual({lines: []});
    expect(next.selection).toEqual({block: block + 1, start: 0, end: 0});
    for (const arrangement of original.arrangements ?? []) {
      const updated = next.song.arrangements?.find(
        item => item.name === arrangement.name,
      );
      expect(
        updated?.slides.map(number => next.song.slides[number - 1]),
      ).toEqual(arrangement.slides.map(number => original.slides[number - 1]));
    }
  });

  it('merges into the previous block and retains its references and extensions', () => {
    const next = editBlocks(
      blockSnapshot(song(), {block: 1, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(next.song.slides[0]).toMatchObject({
      lines: ['first', 'second'],
      label: '1절',
      futureSlide: 1,
    });
    expect(next.song.arrangements?.map(item => item.slides)).toEqual([
      [2, 1, 1],
      [1],
      [],
    ]);
    expect(next.song).toMatchObject({
      future: {kept: true},
      arrangements: [{futureArrangement: true}, {}, {}],
    });
    expect(next.selection).toEqual({block: 0, start: 5, end: 5});
  });

  it('does not merge the first block or a noncollapsed selection', () => {
    for (const selection of [
      {block: 0, start: 0, end: 0},
      {block: 1, start: 0, end: 1},
    ]) {
      const original = song();
      expect(
        editBlocks(blockSnapshot(original, selection), {type: 'merge'}).song,
      ).toBe(original);
    }
  });

  it.each(['X\r\n \r\nY', 'X\n　\nY'])(
    'pastes paragraphs over a selection: %j',
    text => {
      const next = editBlocks(
        blockSnapshot(song(['ab', 'cd']), {block: 0, start: 1, end: 4}),
        {type: 'paste', text},
      );
      expect(next.song.slides.slice(0, 2).map(item => item.lines)).toEqual([
        ['aX'],
        ['Yd'],
      ]);
      expect(next.selection).toEqual({block: 1, start: 1, end: 1});
      expect(next.song.arrangements?.[0]?.slides).toEqual([4, 3, 1, 2, 3]);
    },
  );

  it.each([
    {references: [1, 3, 3], block: 2, expected: [1, 3, 4, 3, 4]},
    {references: [1, 1, 2, 3], block: 0, expected: [1, 2, 1, 2, 3, 4]},
  ])(
    'expands every split reference in $references',
    ({references, block, expected}) => {
      const original = {
        ...song(),
        arrangements: [{name: '반복', slides: references}],
      };
      const next = editBlocks(
        blockSnapshot(original, {block, start: 0, end: 0}),
        {type: 'split'},
      );
      expect(next.song.arrangements?.[0]?.slides).toEqual(expected);
      expect(original.arrangements[0]?.slides).toEqual(references);
      expect(serializeSong(next.song, 'memory.llsong').ok).toBe(true);
    },
  );

  it('expands every Ctrl Enter reference when splitting inside a line', () => {
    const original = {
      ...song(),
      arrangements: [{name: '반복', slides: [1, 3, 3]}],
    };
    const next = editBlocks(
      blockSnapshot(original, {block: 2, start: 2, end: 2}),
      {type: 'split'},
    );
    expect(next.song.slides.slice(2).map(item => item.lines)).toEqual([
      ['th'],
      ['ird'],
    ]);
    expect(next.song.arrangements?.[0]?.slides).toEqual([1, 3, 4, 3, 4]);
    expect(next.selection).toEqual({block: 3, start: 0, end: 0});
    expect(original.slides[2]?.lines).toEqual(['third']);
  });

  it('expands paste references to all three parts on every occurrence', () => {
    const original = {
      ...song(),
      arrangements: [{name: '반복', slides: [2, 3, 2]}],
    };
    const next = editBlocks(
      blockSnapshot(original, {block: 1, start: 0, end: 6}),
      {type: 'paste', text: 'one\n\ntwo\n\nthree'},
    );
    expect(next.song.arrangements?.[0]?.slides).toEqual([2, 3, 4, 5, 2, 3, 4]);
  });

  it.each([
    {references: [2, 3], expected: [2]},
    {references: [3], expected: [2]},
    {references: [3, 2], expected: [2]},
    {references: [1, 3, 1, 2, 3], expected: [1, 2, 1, 2]},
    {references: [2, 2], expected: [2, 2]},
    {references: [3, 3], expected: [2, 2]},
    {references: [2, 3, 2, 3], expected: [2, 2]},
    {references: [3, 2, 3, 2], expected: [2, 2]},
    {references: [2, 2, 3, 3], expected: [2, 2, 2]},
  ])(
    'maps merge references without removing deliberate repeats: $references',
    ({references, expected}) => {
      const original = {
        ...song(),
        arrangements: [{name: '반복', slides: references}],
      };
      const next = editBlocks(
        blockSnapshot(original, {block: 2, start: 0, end: 0}),
        {type: 'merge'},
      );
      expect(next.song.arrangements?.[0]?.slides).toEqual(expected);
      expect(original.arrangements[0]?.slides).toEqual(references);
      expect(serializeSong(next.song, 'memory.llsong').ok).toBe(true);
    },
  );

  it('keeps a terminal blank block and bounds the caret at a paste separator', () => {
    const next = editBlocks(
      blockSnapshot(song(['']), {block: 0, start: 0, end: 0}),
      {type: 'paste', text: 'X\n\n'},
    );
    expect(next.song.slides[1]?.lines).toEqual([]);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
  });

  it('edits text and label without mutating the input or transferring extensions', () => {
    const original = song();
    let next = editBlocks(blockSnapshot(original), {
      type: 'text',
      text: 'new\r\nline',
      start: 8,
      end: 8,
    });
    next = editBlocks(next, {type: 'label', name: '후렴'});
    next = editBlocks(next, {type: 'label', name: undefined});
    expect(next.song.slides[0]).toMatchObject({
      lines: ['new', 'line'],
      label: '',
      futureSlide: 1,
    });
    expect(next.song.slides[1]).toBe(original.slides[1]);
    expect(original.slides[0]?.lines).toEqual(['first']);
    expect(next.song.arrangements).toBe(original.arrangements);
  });

  it.each<BlockCommand>([
    {type: 'paste', text: ''},
    {type: 'text', text: 'first', start: 0, end: 0},
    {type: 'label', name: '1절'},
  ])('does not change a song on a no-op %j', command => {
    const original = song();
    expect(editBlocks(blockSnapshot(original), command).song).toBe(original);
  });
});

describe('song history', () => {
  const type = (history: SongHistory, text: string, time: number) =>
    history.apply(
      {type: 'text', text, start: text.length, end: text.length},
      time,
    );

  it('groups typing only until a full second without input', () => {
    const history = new SongHistory(song());
    type(history, 'a', 0);
    type(history, 'ab', 999);
    type(history, 'abc', 1999);
    expect(history.undo().song.slides[0]?.lines).toEqual(['ab']);
    expect(history.undo().song.slides[0]?.lines).toEqual(['first']);
    expect(history.redo().song.slides[0]?.lines).toEqual(['ab']);
    expect(history.redo().song.slides[0]?.lines).toEqual(['abc']);
  });

  it('ends grouping on block changes, blur, and a backwards clock', () => {
    const history = new SongHistory(song());
    type(history, 'a', 100);
    history.select({block: 1, start: 0, end: 0});
    history.select({block: 0, start: 1, end: 1});
    type(history, 'b', 101);
    history.endTyping();
    type(history, 'c', 102);
    type(history, 'd', 99);
    for (const expected of ['c', 'b', 'a', 'first']) {
      expect(history.undo().song.slides[0]?.lines).toEqual([expected]);
    }
  });

  it('restores structure, references, and selection and discards redo after a new edit', () => {
    const history = new SongHistory(song(['first', '', 'last']));
    history.select({block: 0, start: 6, end: 6});
    const original = history.snapshot;
    const split = history.apply({type: 'enter'});
    expect(history.undo()).toBe(original);
    expect(history.redo()).toBe(split);
    history.undo();
    type(history, 'different', 1);
    expect(history.canRedo).toBe(false);
  });

  it('preserves repeated references through split, merge, undo, and redo', () => {
    const original = {
      ...song(),
      arrangements: [{name: '반복', slides: [1, 3, 3]}],
    };
    const history = new SongHistory(original);
    history.select({block: 2, start: 0, end: 0});
    const before = history.snapshot;
    const split = history.apply({type: 'split'});
    expect(split.song.arrangements[0]?.slides).toEqual([1, 3, 4, 3, 4]);
    const merged = history.apply({type: 'merge'});
    expect(merged.song).toEqual(original);
    expect(history.undo()).toBe(split);
    expect(history.undo()).toBe(before);
    expect(history.redo()).toBe(split);
    expect(history.redo()).toBe(merged);
  });

  it('retains exactly 100 undo steps and keeps song sessions independent', () => {
    const first = new SongHistory(song());
    const second = new SongHistory(
      song(['other'], '7f1c2a9e-4b7d-4c1a-9e2f-0123456789ab'),
    );
    for (let index = 0; index < 102; index++) {
      type(first, String(index), index * 1001);
    }
    for (let index = 0; index < 100; index++) first.undo();
    expect(first.canUndo).toBe(false);
    expect(first.snapshot.song.slides[0]?.lines).toEqual(['1']);
    for (let index = 0; index < 100; index++) first.redo();
    expect(first.snapshot.song.slides[0]?.lines).toEqual(['101']);
    expect(first.canRedo).toBe(false);
    expect(second.snapshot.song.slides[0]?.lines).toEqual(['other']);
    expect(second.canUndo).toBe(false);
  });
});

function sampleGroupedSong(
  groups: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly slides: ReadonlyArray<{
      readonly lines: readonly string[];
      readonly hotKey?: string;
    }>;
  }> = [
    {
      id: '11111111-1111-4111-a111-111111111111',
      name: '1절',
      slides: [{lines: ['first']}, {lines: ['second']}],
    },
    {
      id: '22222222-2222-4222-a222-222222222222',
      name: '후렴',
      slides: [{lines: ['third']}],
    },
  ],
  arrangements: ReadonlyArray<{
    readonly name: string;
    readonly groups: readonly string[];
  }> = [
    {
      name: '기본순서',
      groups: [
        '11111111-1111-4111-a111-111111111111',
        '22222222-2222-4222-a222-222222222222',
      ],
    },
  ],
): GroupedSong {
  return expectSuccess(
    parseGroupedSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 2,
        id: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
        title: '새 아침',
        groups,
        arrangements,
      }),
      'memory.llsong',
    ),
  ).data;
}

describe('grouped song block edits', () => {
  it('indexes linear blocks across groups and detects group starts', () => {
    const song = sampleGroupedSong();
    expect(slideCountOf(song)).toBe(3);

    const addr0 = linearBlockAddress(song, 0);
    expect(addr0).toMatchObject({
      groupIndex: 0,
      groupId: '11111111-1111-4111-a111-111111111111',
      groupName: '1절',
      slideIndex: 0,
      isGroupStart: true,
      slide: {lines: ['first']},
    });

    const addr1 = linearBlockAddress(song, 1);
    expect(addr1).toMatchObject({
      groupIndex: 0,
      groupId: '11111111-1111-4111-a111-111111111111',
      groupName: '1절',
      slideIndex: 1,
      isGroupStart: false,
      slide: {lines: ['second']},
    });

    const addr2 = linearBlockAddress(song, 2);
    expect(addr2).toMatchObject({
      groupIndex: 1,
      groupId: '22222222-2222-4222-a222-222222222222',
      groupName: '후렴',
      slideIndex: 0,
      isGroupStart: true,
      slide: {lines: ['third']},
    });

    expect(linearBlockAddress(song, 3)).toBeUndefined();
  });

  it('linearSlidesOf produces items with labels only on group start', () => {
    const song = sampleGroupedSong();
    const slides = linearSlidesOf(song);
    expect(slides).toEqual([
      {
        lines: ['first'],
        label: '1절',
        isGroupStart: true,
        groupId: '11111111-1111-4111-a111-111111111111',
        slideIndex: 0,
      },
      {
        lines: ['second'],
        isGroupStart: false,
        groupId: '11111111-1111-4111-a111-111111111111',
        slideIndex: 1,
      },
      {
        lines: ['third'],
        label: '후렴',
        isGroupStart: true,
        groupId: '22222222-2222-4222-a222-222222222222',
        slideIndex: 0,
      },
    ]);
  });

  it('updates text within a slide inside its group', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 1, start: 0, end: 6}),
      {type: 'text', text: 'modified', start: 0, end: 8},
    );
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual(['modified']);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['first']);
    expect(next.song.groups[1]?.slides[0]?.lines).toEqual(['third']);
    expect(next.song.arrangements).toEqual(original.arrangements);
    expect(serializeGroupedSong(next.song, 'memory.llsong').ok).toBe(true);
  });

  it('splits slide within its group on empty line Enter and preserves arrangement references', () => {
    const original = sampleGroupedSong();
    // NOTE(0913vision): In block 0: 'first\n\nlast'
    const withBlank = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 5}),
      {type: 'text', text: 'first\n\nlast', start: 0, end: 11},
    );
    const next = editBlocks(
      blockSnapshot(withBlank.song, {block: 0, start: 6, end: 6}),
      {type: 'enter'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(3);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['first']);
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual(['last']);
    expect(next.song.groups[0]?.slides[2]?.lines).toEqual(['second']);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
    expect(next.song.groups[1]?.slides).toEqual(original.groups[1]?.slides);
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('splits slide within group via Ctrl Enter split command', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 2, end: 4}),
      {type: 'split'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(3);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['fi']);
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual(['t']);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('inserts empty slide within group via Ctrl Shift N insert command', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'insert'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(3);
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual([]);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('pastes multi-line text with blank lines into multiple slides inside the group', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 5, end: 5}),
      {type: 'paste', text: '\n\nsecondPart\n\nthirdPart'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(4);
    expect(next.song.groups[0]?.slides.map(s => s.lines)).toEqual([
      ['first'],
      ['secondPart'],
      ['thirdPart'],
      ['second'],
    ]);
  });

  it('renames group name via label command', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: '새 이름'},
    );
    expect(next.song.groups[0]?.name).toBe('새 이름');
    expect(next.song.groups[0]?.id).toBe(original.groups[0]?.id);
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('merges within the same group when Backspace is pressed at start of non-first slide', () => {
    const original = sampleGroupedSong();
    // NOTE(0913vision): Block 1 is second slide of group 0
    const next = editBlocks(
      blockSnapshot(original, {block: 1, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(1);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['first', 'second']);
    expect(next.song.groups[1]?.slides).toEqual(original.groups[1]?.slides);
    expect(next.song.arrangements).toEqual(original.arrangements);
    expect(next.selection).toEqual({block: 0, start: 5, end: 5});
    expect(next.mergeRefused).toBeUndefined();
  });

  it('preserves first hotKey or inherits on merge within group', () => {
    const singleArrangement = [
      {
        name: '기본순서',
        groups: ['11111111-1111-4111-a111-111111111111'],
      },
    ];
    const withBothKeys = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [
            {lines: ['first'], hotKey: 'Digit1'},
            {lines: ['second'], hotKey: 'Digit2'},
          ],
        },
      ],
      singleArrangement,
    );
    const mergedBoth = editBlocks(
      blockSnapshot(withBothKeys, {block: 1, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(mergedBoth.song.groups[0]?.slides[0]?.hotKey).toBe('Digit1');

    const withSecondKey = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [{lines: ['first']}, {lines: ['second'], hotKey: 'Digit2'}],
        },
      ],
      singleArrangement,
    );
    const mergedSecond = editBlocks(
      blockSnapshot(withSecondKey, {block: 1, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(mergedSecond.song.groups[0]?.slides[0]?.hotKey).toBe('Digit2');
  });

  it('keeps hotKey on first slide and leaves new slide without hotKey on split and enter', () => {
    const singleArrangement = [
      {
        name: '기본순서',
        groups: ['11111111-1111-4111-a111-111111111111'],
      },
    ];
    const withKey = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [{lines: ['first', 'second'], hotKey: 'Digit1'}],
        },
      ],
      singleArrangement,
    );
    const split = editBlocks(
      blockSnapshot(withKey, {block: 0, start: 5, end: 5}),
      {type: 'split'},
    );
    expect(split.song.groups[0]?.slides[0]?.hotKey).toBe('Digit1');
    expect(split.song.groups[0]?.slides[1]?.hotKey).toBeUndefined();

    const withEmptyLine = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [{lines: ['first', '', 'second'], hotKey: 'Digit1'}],
        },
      ],
      singleArrangement,
    );
    const entered = editBlocks(
      blockSnapshot(withEmptyLine, {block: 0, start: 6, end: 6}),
      {type: 'enter'},
    );
    expect(entered.song.groups[0]?.slides[0]?.hotKey).toBe('Digit1');
    expect(entered.song.groups[0]?.slides[1]?.hotKey).toBeUndefined();
  });

  it('refuses merge at group boundary (first slide of any group) with mergeRefused: true', () => {
    const original = sampleGroupedSong();
    // NOTE(0913vision): Block 0 is first slide of group 0 (group boundary)
    const atFirst = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(atFirst.song).toBe(original);
    expect(atFirst.mergeRefused).toBe(true);

    // NOTE(0913vision): Block 2 is first slide of group 1 (group boundary between 1절 and 후렴)
    const atSecondGroup = editBlocks(
      blockSnapshot(original, {block: 2, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(atSecondGroup.song).toBe(original);
    expect(atSecondGroup.mergeRefused).toBe(true);
    expect(atSecondGroup.song.groups).toHaveLength(2);
    expect(atSecondGroup.song.arrangements).toEqual(original.arrangements);
  });

  it('supports undo, redo, and setArrangementGroups on grouped songs', () => {
    const original = sampleGroupedSong();
    const history = new SongHistory(original);
    history.select({block: 0, start: 5, end: 5});
    const before = history.snapshot;
    const split = history.apply({type: 'split'});
    expect(history.undo()).toBe(before);
    expect(history.redo()).toBe(split);

    // NOTE(0913vision): setArrangementGroups
    const newGroups = [
      createSongGroupId('22222222-2222-4222-a222-222222222222'),
      createSongGroupId('11111111-1111-4111-a111-111111111111'),
    ];
    const changed = history.setArrangementGroups('기본순서', newGroups);
    expect(changed).toBe(true);
    expect(history.snapshot.song.arrangements?.[0]?.groups).toEqual(newGroups);
    expect(history.canUndo).toBe(true);
    history.undo();
    expect(history.snapshot.song.arrangements?.[0]?.groups).toEqual([
      '11111111-1111-4111-a111-111111111111',
      '22222222-2222-4222-a222-222222222222',
    ]);
  });

  it('renames a group at slide 0 preserving UUID and arrangement references without merging', () => {
    const original = sampleGroupedSong();
    const g1Id = original.groups[0]?.id;
    const g2Id = original.groups[1]?.id;

    const renamed = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: '3절'},
    );
    expect(renamed.song.groups[0]?.id).toBe(g1Id);
    expect(renamed.song.groups[0]?.name).toBe('3절');
    expect(renamed.song.groups).toHaveLength(2);
    expect(renamed.song.arrangements?.[0]?.groups).toEqual([g1Id, g2Id]);

    const sameName = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: '후렴'},
    );
    expect(sameName.song.groups).toHaveLength(2);
    expect(sameName.song.groups[0]?.name).toBe('후렴');
    expect(sameName.song.groups[0]?.id).toBe(g1Id);
    expect(sameName.song.groups[1]?.name).toBe('후렴');
    expect(sameName.song.groups[1]?.id).toBe(g2Id);

    const noLabel = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: undefined},
    );
    expect(noLabel.song.groups[0]?.name).toBe('');
    expect(noLabel.song.groups[0]?.id).toBe(g1Id);
  });

  it('splits a group at slideIndex > 0 with caller-provided IDs and preserves unknown fields', () => {
    const original = sampleGroupedSong();
    const firstGroup = original.groups[0];
    const secondGroup = original.groups[1];
    if (firstGroup === undefined || secondGroup === undefined) {
      throw new Error('Missing sample groups');
    }
    const withUnknownFields = {
      ...original,
      groups: [{...firstGroup, futureGroupProp: 'preserve-me'}, secondGroup],
    };
    const oldG2Id = secondGroup.id;

    const newG0Id = createSongGroupId('10000000-0000-4000-8000-000000000001');
    const newG1Id = createSongGroupId('10000000-0000-4000-8000-000000000002');

    const split = editBlocks(
      blockSnapshot(withUnknownFields, {block: 1, start: 0, end: 0}),
      {type: 'label', name: '2절', ids: [newG0Id, newG1Id]},
    );

    expect(split.song.groups).toHaveLength(3);
    const g0 = split.song.groups[0];
    const g1 = split.song.groups[1];
    const g2 = split.song.groups[2];
    if (g0 === undefined || g1 === undefined || g2 === undefined) {
      throw new Error('Expected 3 groups');
    }

    expect(g0.name).toBe('1절');
    expect(g0.slides.map(s => s.lines)).toEqual([['first']]);
    expect(g0.id).toBe(newG0Id);
    expect(Reflect.get(g0, 'futureGroupProp')).toBe('preserve-me');

    expect(g1.name).toBe('2절');
    expect(g1.slides.map(s => s.lines)).toEqual([['second']]);
    expect(g1.id).toBe(newG1Id);
    expect(Reflect.get(g1, 'futureGroupProp')).toBe('preserve-me');

    expect(g2.name).toBe('후렴');
    expect(g2.id).toBe(oldG2Id);

    expect(split.song.arrangements?.[0]?.groups).toEqual([
      newG0Id,
      newG1Id,
      oldG2Id,
    ]);
    expect(split.selection).toEqual({block: 1, start: 0, end: 0});
  });

  it('undoes and redoes group splitting restoring original groups and arrangements', () => {
    const original = sampleGroupedSong();
    const history = new SongHistory(original);
    const newG0Id = createSongGroupId('10000000-0000-4000-8000-000000000001');
    const newG1Id = createSongGroupId('10000000-0000-4000-8000-000000000002');

    history.select({block: 1, start: 0, end: 0});
    history.apply({type: 'label', name: '2절', ids: [newG0Id, newG1Id]});

    expect(history.snapshot.song.groups).toHaveLength(3);
    expect(history.snapshot.song.groups[1]?.name).toBe('2절');

    history.undo();
    expect(history.snapshot.song.groups).toHaveLength(2);
    expect(history.snapshot.song.groups[0]?.slides).toHaveLength(2);
    expect(history.snapshot.song.groups[0]?.name).toBe('1절');

    history.redo();
    expect(history.snapshot.song.groups).toHaveLength(3);
    expect(history.snapshot.song.groups[0]?.id).toBe(newG0Id);
    expect(history.snapshot.song.groups[1]?.id).toBe(newG1Id);
    expect(history.snapshot.song.groups[1]?.name).toBe('2절');
  });
});
