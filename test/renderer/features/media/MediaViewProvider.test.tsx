import {act, renderHook, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {
  audioPlaylistId,
  mediaDocument,
  mediaFixture,
  mediaId,
  mediaItem,
  playlistId,
} from '@fixtures/renderer/features/media/mediaTesting';
import {
  MediaViewProvider,
  useMediaView,
} from '@renderer/features/media/MediaViewProvider';

const ITEMS = [
  mediaItem(1, {name: 'Dawn', file: 'dawn.mp4'}),
  mediaItem(2, {name: 'Notice', kind: 'image', file: 'notice.png'}),
  mediaItem(3, {name: 'Hymn', kind: 'audio', file: 'hymn.mp3'}),
];

async function setup(document: MediaDocument) {
  const fixture = mediaFixture(document);
  function wrapper({children}: {readonly children: ReactNode}) {
    return (
      <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
        {children}
      </MediaViewProvider>
    );
  }
  const {result} = renderHook(() => useMediaView(), {wrapper});
  await waitFor(() => expect(result.current.view.document).not.toBeNull());
  return {fixture, result};
}

describe('useMediaView', () => {
  it.each(['media', 'audio'] as const)(
    'reads a selection outside the chosen %s playlist as none',
    async kind => {
      const {result} = await setup(
        mediaDocument(
          ITEMS,
          5,
          kind === 'media'
            ? {
                playlists: [
                  {id: playlistId(1), name: 'Other', items: [mediaId(2)]},
                ],
              }
            : {
                audioPlaylists: [
                  {
                    id: audioPlaylistId(1),
                    name: 'Other',
                    items: [mediaId(3)],
                    loop: false,
                  },
                ],
              },
        ),
      );
      act(() => result.current.select(mediaId(1)));
      expect(result.current.selected).toBe(mediaId(1));

      act(() =>
        result.current.choose({
          kind,
          id: kind === 'media' ? playlistId(1) : audioPlaylistId(1),
        }),
      );

      expect(result.current.selected).toBeNull();
    },
  );

  it('drops a selection when a push removes it from the chosen playlist', async () => {
    const playlist = {
      id: playlistId(1),
      name: 'Selected list',
      items: [mediaId(1), mediaId(2)],
    };
    const {fixture, result} = await setup(
      mediaDocument(ITEMS, 5, {playlists: [playlist]}),
    );
    act(() => result.current.select(mediaId(1)));
    act(() => result.current.choose({kind: 'media', id: playlistId(1)}));
    expect(result.current.selected).toBe(mediaId(1));

    act(() =>
      fixture.pushDocument(
        mediaDocument(ITEMS, 6, {
          playlists: [{...playlist, items: [mediaId(2)]}],
        }),
      ),
    );

    expect(result.current.selected).toBeNull();
  });

  it('reads a chosen playlist that is gone as all media', async () => {
    const {fixture, result} = await setup(
      mediaDocument(ITEMS, 5, {
        playlists: [{id: playlistId(1), name: 'Gone', items: [mediaId(1)]}],
      }),
    );
    act(() => result.current.choose({kind: 'media', id: playlistId(1)}));

    act(() => fixture.pushDocument(mediaDocument(ITEMS, 6)));

    expect(result.current.choice).toEqual({kind: 'all'});
  });
});
