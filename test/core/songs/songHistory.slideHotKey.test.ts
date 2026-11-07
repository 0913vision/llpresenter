import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {expect, it} from 'vitest';
import type {Song} from '@core/schema/song';
import type {SongSlideSource} from '@core/schema/showService';
import {SongHistory} from '@core/songs/songHistory';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';

function sourceOf(song: Song): SongSlideSource {
  const group = song.slides[1];
  if (group === undefined) throw new Error('Missing source group fixture');
  return {songId: song.id, slideId: group.id};
}

it('separates key assignment from typing and preserves the cursor through undo, redo and removal', () => {
  const song = sampleSong();
  const source = sourceOf(song);
  const history = new SongHistory(song);
  history.select({block: 2, start: 1, end: 3});
  history.apply(
    {type: 'text', text: 'Invented changed line', start: 4, end: 4},
    0,
  );
  const typed = history.snapshot;
  expect(history.inTypingGroup).toBe(true);
  expect(history.setSlideHotKey(source, 'KeyC')).toBe(true);
  expect(history.inTypingGroup).toBe(false);
  expect(history.snapshot.selection).toBe(typed.selection);
  expect(history.snapshot.song.slides[1]?.hotKey).toBe('KeyC');
  expect(history.undo()).toBe(typed);
  expect(history.undo().song).toBe(song);
  expect(history.redo()).toBe(typed);
  expect(history.redo().song.slides[1]?.hotKey).toBe('KeyC');
  expect(history.setSlideHotKey(source, undefined)).toBe(true);
  expect(history.snapshot.song.slides[1]?.hotKey).toBeUndefined();
  expect(history.undo().song.slides[1]?.hotKey).toBe('KeyC');
});

it('preserves redo and history for unchanged, invalid or duplicate assignments', () => {
  const song = sampleSong();
  const source = sourceOf(song);
  const history = new SongHistory(song);
  expect(history.setSlideHotKey(source, 'KeyC')).toBe(true);
  history.undo();
  const before = history.snapshot;
  expect(history.setSlideHotKey(source, undefined)).toBe(false);
  expect(history.setSlideHotKey(source, 'F1')).toBe(false);
  expect(
    history.setSlideHotKey({...source, slideId: fixtureSlideId(9)}, 'KeyC'),
  ).toBe(false);
  expect(history.snapshot).toBe(before);
  expect(history.canRedo).toBe(true);
  history.redo();
  const first = song.slides[0];
  if (first === undefined) throw new Error('Missing first group fixture');
  expect(history.setSlideHotKey({...source, slideId: first.id}, 'KeyC')).toBe(
    false,
  );
  expect(history.undo().song).toBe(song);
  expect(history.canUndo).toBe(false);
});
