import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {SongDocument} from '@core/schema/contentDocuments';
import {setup} from '@fixtures/renderer/features/songs/library/libraryPanelFixtures';
import {
  LibraryPanel,
  type LibrarySelectionRequest,
} from '@renderer/features/songs/library/LibraryPanel';

async function requests() {
  const view = await setup();
  const song = view.fixture.list()[0];
  if (song === undefined) throw new Error('Missing library song');
  const onSelectionHandled = vi.fn();
  const request = (selectionRequest: LibrarySelectionRequest): void =>
    view.rerender(
      <LibraryPanel
        api={view.fixture.api}
        onOpenSong={view.onOpenSong}
        onProblem={view.onProblem}
        selectionRequest={selectionRequest}
        onSelectionHandled={onSelectionHandled}
      />,
    );
  return {...view, song, onSelectionHandled, request};
}

describe('library panel selection requests', () => {
  it('clears the search and opens a requested song at the requested slide', async () => {
    const {fixture, song, onOpenSong, onSelectionHandled, request} =
      await requests();
    const search = screen.getByRole('textbox', {name: '라이브러리 검색'});
    fireEvent.change(search, {target: {value: '찬송'}});
    const open: LibrarySelectionRequest = {
      kind: 'open',
      songId: song.id,
      position: 2,
    };

    request(open);

    await waitFor(() =>
      expect(onOpenSong).toHaveBeenCalledWith({
        document: fixture.documents.get(song.id),
        focusTitle: false,
        position: 2,
      }),
    );
    expect(search).toHaveProperty('value', '');
    expect(onSelectionHandled).toHaveBeenCalledExactlyOnceWith(open);
  });

  it('does not open the same request again on a later render', async () => {
    const {song, onOpenSong, request} = await requests();
    const open: LibrarySelectionRequest = {kind: 'open', songId: song.id};

    request(open);
    await waitFor(() => expect(onOpenSong).toHaveBeenCalledOnce());
    request(open);
    await act(() => Promise.resolve());

    expect(onOpenSong).toHaveBeenCalledOnce();
  });

  it('cancels a pending open when a clear request arrives', async () => {
    const {fixture, song, onOpenSong, request} = await requests();
    let finish: (document: SongDocument | null) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'get').mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );

    request({kind: 'open', songId: song.id});
    request({kind: 'clear'});
    await act(async () => finish(fixture.documents.get(song.id) ?? null));

    expect(onOpenSong).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', {selected: true})).toBeNull();
  });
});
