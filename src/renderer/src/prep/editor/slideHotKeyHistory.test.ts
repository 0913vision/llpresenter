import {expect, it, vi} from 'vitest';
import type {GroupedSong} from '@shared/schema/groupedSong';
import type {SongSlideSource} from '@shared/schema/showService';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {editorGroupedSong, editorLegacySong} from './editorFixture';
import {SongHistory} from './songHistory';
import {SongSession} from './songSession';

function sourceOf(song: GroupedSong): SongSlideSource {
  const group = song.groups[1];
  if (group === undefined) throw new Error('Missing source group fixture');
  return {songId: song.id, groupId: group.id, slideIndex: 0};
}

it('separates key assignment from typing and preserves the cursor through undo, redo and removal', () => {
  const {song} = editorGroupedSong(1);
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
  const {song} = editorGroupedSong(1);
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
  const song = editorLegacySong(1);
  const history = new SongHistory(song);
  expect(
    history.setSlideHotKey(sourceOf(editorGroupedSong(1).song), 'KeyC'),
  ).toBe(false);
  expect(history.snapshot.song).toBe(song);
  expect(history.canUndo).toBe(false);
});

it('marks accepted assignments dirty and routes undo and redo through the owning session', () => {
  const document = editorGroupedSong(1);
  const changed = vi.fn();
  const session = new SongSession({
    document,
    api: fakeLlpApi().content,
    changed,
    problem: vi.fn(),
    persistence: 'manual',
  });
  const source = sourceOf(document.song);
  expect(session.clean).toBe(true);
  expect(session.setSlideHotKey(source, 'Digit3')).toBe(true);
  expect(session.clean).toBe(false);
  expect(changed).toHaveBeenCalledOnce();
  expect(session.history.snapshot.song.groups[1]?.slides[0]?.hotKey).toBe(
    'Digit3',
  );
  session.edit('undo');
  expect(
    session.history.snapshot.song.groups[1]?.slides[0]?.hotKey,
  ).toBeUndefined();
  session.edit('redo');
  expect(session.history.snapshot.song.groups[1]?.slides[0]?.hotKey).toBe(
    'Digit3',
  );
  const calls = changed.mock.calls.length;
  expect(session.setSlideHotKey(source, 'Digit3')).toBe(false);
  expect(session.setSlideHotKey(source, 'F1')).toBe(false);
  expect(changed).toHaveBeenCalledTimes(calls);
  session.discard();
});

it.each(['readOnly', 'blocked', 'close-preflight', 'closed', 'discarded'])(
  'refuses key edits while the session is %s',
  async lock => {
    const document = editorGroupedSong(
      1,
      lock === 'readOnly' ? 'readOnly' : 'editable',
    );
    const changed = vi.fn();
    const session = new SongSession({
      document,
      api: fakeLlpApi().content,
      changed,
      problem: vi.fn(),
      persistence: 'manual',
      editingStopped: () => lock === 'close-preflight',
    });
    if (lock === 'blocked') session.blocked = true;
    if (lock === 'closed') await session.close();
    if (lock === 'discarded') session.discard();
    const before = session.history.snapshot;
    expect(session.setSlideHotKey(sourceOf(document.song), 'KeyC')).toBe(false);
    expect(session.history.snapshot).toBe(before);
    expect(session.history.canUndo).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    session.discard();
  },
);
