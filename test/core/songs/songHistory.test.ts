import {describe, expect, it} from 'vitest';
import {song} from '@fixtures/core/songs/blockFixtures';
import {SongHistory} from '@core/songs/songHistory';

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
