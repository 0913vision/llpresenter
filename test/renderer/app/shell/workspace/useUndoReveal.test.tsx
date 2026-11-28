import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useUndoReveal} from '@renderer/app/shell/workspace/useUndoReveal';
import {usePrepLibraryChoice} from '@renderer/session/prepLibraryChoice';
import {
  undoTimeline,
  type UndoOwner,
} from '@renderer/platform/undo/undoTimeline';

const SONG = '00000000-0000-4000-8000-000000000301';
const owners: UndoOwner[] = [];

afterEach(() => {
  for (const owner of owners.splice(0)) undoTimeline.forget(owner);
  undoTimeline.showTab('prep');
});

/** A deleted song's history, made on the tab on screen. */
function songDeletion(): UndoOwner {
  const owner: UndoOwner = {
    replay: () => Promise.resolve(true),
    place: () => ({kind: 'song', songId: SONG}),
  };
  owners.push(owner);
  undoTimeline.record(owner);
  return owner;
}

it('chooses a song deleted in 준비 in 준비 again, without going to 라이브러리', async () => {
  const showSong = vi.fn();
  undoTimeline.showTab('prep');
  renderHook(() => useUndoReveal(showSong, 'prep'));
  const before = usePrepLibraryChoice.getState().turn;
  songDeletion();
  await act(() => undoTimeline.replay('undo', vi.fn()));
  expect(showSong).not.toHaveBeenCalled();
  expect(usePrepLibraryChoice.getState()).toMatchObject({
    songId: SONG,
    turn: before + 1,
  });
});

it('opens a song deleted in 라이브러리 again there', async () => {
  const showSong = vi.fn();
  undoTimeline.showTab('library');
  renderHook(() => useUndoReveal(showSong, 'library'));
  const before = usePrepLibraryChoice.getState().turn;
  songDeletion();
  await act(() => undoTimeline.replay('undo', vi.fn()));
  expect(showSong).toHaveBeenCalledWith(SONG);
  expect(usePrepLibraryChoice.getState().turn).toBe(before);
});
