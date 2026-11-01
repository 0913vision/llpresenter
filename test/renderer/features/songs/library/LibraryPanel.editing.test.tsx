import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import type {LibrarySong, SongDocument} from '@core/schema/contentDocuments';
import {readSongDragData, SONG_DRAG_MIME} from '@core/schema/songDrag';
import {
  fixtureSong,
  libraryFixture,
} from '@renderer/features/songs/library/fixture';
import {LibraryPanel} from '@renderer/features/songs/library/LibraryPanel';
import {LibrarySection} from '@renderer/gallery/LibrarySection';
import {
  FixedObserver,
  setup,
} from '@fixtures/renderer/features/songs/library/libraryPanelFixtures';

describe('library panel', () => {
  it('creates sequential new songs with one blank slide and focuses the editor title in the gallery host', async () => {
    render(<LibrarySection />);
    const user = userEvent.setup();
    await screen.findAllByRole('option');
    await user.click(screen.getByRole('button', {name: '새 곡'}));
    const first = await screen.findByDisplayValue('새 곡');
    expect(document.activeElement).toBe(first);
    await user.click(screen.getByRole('button', {name: '새 곡'}));
    const second = await screen.findByDisplayValue('새 곡 2');
    expect(document.activeElement).toBe(second);
    expect(screen.getByRole('option', {name: '새 곡 2'}).textContent).toContain(
      '슬라이드 1개',
    );
  });

  it('asks with the current service count, supports cancel, then deletes only on confirmation', async () => {
    const {fixture, user} = await setup();
    const edit = vi.spyOn(fixture.api.content, 'edit');
    const openDelete = async (): Promise<void> => {
      fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
      await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    };
    await openDelete();
    expect(screen.getByText('예배 순서 2곳에서 씀')).toBeDefined();
    expect(edit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: '취소'}));
    expect(edit).not.toHaveBeenCalled();
    await openDelete();
    act(() =>
      fixture.pushList(fixture.list().map(song => ({...song, usedBy: []}))),
    );
    expect(screen.queryByText('예배 순서 0곳에서 씀')).toBeNull();
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('option', {name: '찬송 10'})).toBeNull(),
    );
    expect(edit).toHaveBeenCalledWith({
      type: 'song.delete',
      songId: fixtureSong(1, '찬송 10').song.id,
    });
  });

  it('disables deletion of read-only songs', async () => {
    const fixture = libraryFixture([fixtureSong(1, 'Read only')]);
    vi.spyOn(fixture.api.songs, 'list').mockResolvedValue(
      fixture.list().map(song => ({...song, access: 'readOnly'})),
    );
    const {user} = await setup(fixture);
    fireEvent.contextMenu(screen.getByRole('option', {name: 'Read only'}));
    const item = screen.getByRole('menuitem', {name: '삭제'});
    expect(item.getAttribute('aria-disabled')).toBe('true');
    await user.click(item);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('uses the shared song drag payload and a copy operation', async () => {
    const {fixture} = await setup();
    const data = new Map<string, string>();
    const transfer = {
      effectAllowed: 'none',
      setData: (type: string, text: string) => data.set(type, text),
    };
    const row = screen
      .getByRole('option', {name: '찬송 10'})
      .closest('[draggable]');
    if (!row) throw new Error('Missing drag source');
    fireEvent.dragStart(row, {dataTransfer: transfer});
    expect(transfer.effectAllowed).toBe('copy');
    expect(readSongDragData(data.get(SONG_DRAG_MIME) ?? '')).toEqual({
      ok: true,
      value: {kind: 'song', songId: fixture.list()[0]?.id},
    });
  });

  it('keeps selection when releasing a library drag and allows the next click', async () => {
    await setup();
    const row = screen.getByRole('option', {name: '찬송 10'});
    const previous = row.getAttribute('aria-selected');
    fireEvent.dragStart(row, {dataTransfer: {setData: vi.fn()}});
    fireEvent.dragEnd(row);
    fireEvent.click(row, {detail: 1});
    expect(row.getAttribute('aria-selected')).toBe(previous);
    fireEvent.pointerDown(row);
    fireEvent.click(row, {detail: 1});
    expect(row.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps a newer pushed list when the initial read finishes late and removes subscriptions', async () => {
    const fixture = libraryFixture();
    let finish: (songs: readonly LibrarySong[]) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'list').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const result = render(
      <LibraryPanel
        api={fixture.api}
        onOpenSong={() => undefined}
        onProblem={() => undefined}
      />,
    );
    const newer = fixture
      .list()
      .map(song => ({...song, title: `New ${song.title}`}));
    act(() => fixture.pushList(newer));
    await act(async () => finish(fixture.list()));
    expect(screen.getByRole('option', {name: 'New 찬송 10'})).toBeDefined();
    result.unmount();
    expect(fixture.listListeners.size).toBe(0);
    expect(fixture.songListeners.size).toBe(0);
    expect(
      FixedObserver.instances.every(
        observer => observer.disconnect.mock.calls.length > 0,
      ),
    ).toBe(true);
  });

  it('does not open a song that is removed during its document lookup', async () => {
    const fixture = libraryFixture();
    let finish: (document: SongDocument | null) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'get').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {onOpenSong, user} = await setup(fixture);
    const original = fixtureSong(1, '찬송 10');
    await user.click(screen.getByRole('option', {name: '찬송 10'}));
    act(() =>
      fixture.pushList(
        fixture.list().filter(song => song.id !== original.song.id),
      ),
    );
    await act(async () => finish(original));
    expect(onOpenSong).not.toHaveBeenCalled();
  });

  it('virtualizes 3000 rows and navigates to the offscreen final row', async () => {
    const fixture = libraryFixture(
      Array.from({length: 3000}, (_, index) =>
        fixtureSong(index, `곡 ${index}`),
      ),
    );
    await setup(fixture);
    expect(screen.getAllByRole('option').length).toBeLessThan(30);
    fireEvent.keyDown(screen.getByRole('option', {name: '곡 0'}), {key: 'End'});
    const last = await screen.findByRole('option', {name: '곡 2999'});
    expect(document.activeElement).toBe(last);
    expect(screen.getByText('3000개')).toBeDefined();
  });
});
