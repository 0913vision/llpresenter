import {describe, expect, it} from 'vitest';
import {serializeSong} from '../schema/song';
import {song} from './testing/blockFixtures';
import {blockSnapshot, type BlockCommand} from './blockModel';
import {editLegacyBlocks as editBlocks} from './legacyBlockEdits';

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
