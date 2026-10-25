import {describe, expect, it} from 'vitest';
import {parseSong, serializeSong} from '@shared/schema/song';
import {expectSuccess} from '@shared/schema/testHelpers';
import {blockSnapshot, editBlocks, type BlockCommand} from './blockEdits';
import {SongHistory} from './songHistory';

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
        [4, 3, 1, 3],
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

  it('merges into the previous block and drops deleted references, preserving extensions', () => {
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
      [2, 1],
      [],
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
      expect(next.song.arrangements?.[0]?.slides).toEqual([4, 3, 1, 3]);
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
