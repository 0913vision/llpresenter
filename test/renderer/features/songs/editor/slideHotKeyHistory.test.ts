import {expect, it, vi} from 'vitest';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {SongSlideSource} from '@core/schema/showService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {editorGroupedSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongSession} from '@renderer/features/songs/editor/songSession';

function sourceOf(song: GroupedSong): SongSlideSource {
  const group = song.groups[1];
  if (group === undefined) throw new Error('Missing source group fixture');
  return {songId: song.id, groupId: group.id, slideIndex: 0};
}

it('marks accepted assignments dirty and routes undo and redo through the owning session', () => {
  const document = editorGroupedSong(1);
  const changed = vi.fn();
  const session = new SongSession({
    document,
    api: mockLlpApi().content,
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
      api: mockLlpApi().content,
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
