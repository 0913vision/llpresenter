import {expect, it} from 'vitest';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {SongSlideSource} from '@core/schema/showService';
import {SongHistory} from '@core/songs/songHistory';
import {
  sampleGroupedSong,
  song as legacySong,
} from '@fixtures/core/songs/blockFixtures';

function sourceOf(song: GroupedSong): SongSlideSource {
  const group = song.groups[1];
  if (group === undefined) throw new Error('Missing source group fixture');
  return {songId: song.id, groupId: group.id, slideIndex: 0};
}

it('separates key assignment from typing and preserves the cursor through undo, redo and removal', () => {
  const song = sampleGroupedSong();
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
  expect(history.snapshot.song.groups[1]?.slides[0]?.hotKey).toBe('KeyC');
  expect(history.snapshot.song.arrangements).toBe(song.arrangements);
  expect(history.undo()).toBe(typed);
  expect(history.undo().song).toBe(song);
  expect(history.redo()).toBe(typed);
  expect(history.redo().song.groups[1]?.slides[0]?.hotKey).toBe('KeyC');
  expect(history.setSlideHotKey(source, undefined)).toBe(true);
  expect(history.snapshot.song.groups[1]?.slides[0]?.hotKey).toBeUndefined();
  expect(history.undo().song.groups[1]?.slides[0]?.hotKey).toBe('KeyC');
});

it('preserves redo and history for unchanged, invalid or duplicate assignments', () => {
  const song = sampleGroupedSong();
  const source = sourceOf(song);
  const history = new SongHistory(song);
  expect(history.setSlideHotKey(source, 'KeyC')).toBe(true);
  history.undo();
  const before = history.snapshot;
  expect(history.setSlideHotKey(source, undefined)).toBe(false);
  expect(history.setSlideHotKey(source, 'F1')).toBe(false);
  expect(history.setSlideHotKey({...source, slideIndex: 9}, 'KeyC')).toBe(
    false,
  );
  expect(history.snapshot).toBe(before);
  expect(history.canRedo).toBe(true);
  history.redo();
  const first = song.groups[0];
  if (first === undefined) throw new Error('Missing first group fixture');
  expect(history.setSlideHotKey({...source, groupId: first.id}, 'KeyC')).toBe(
    false,
  );
  expect(history.undo().song).toBe(song);
  expect(history.canUndo).toBe(false);
});

it('does not add grouped metadata to a legacy song', () => {
  const song = legacySong();
  const history = new SongHistory(song);
  expect(history.setSlideHotKey(sourceOf(sampleGroupedSong()), 'KeyC')).toBe(
    false,
  );
  expect(history.snapshot.song).toBe(song);
  expect(history.canUndo).toBe(false);
});
