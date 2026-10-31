import {describe, expect, it} from 'vitest';
import {createSongGroupId} from '../schema/ids';
import {song, sampleGroupedSong} from './testing/blockFixtures';
import {SongHistory} from './songHistory';

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

describe('grouped song block edits', () => {
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
