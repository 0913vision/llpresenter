import {act, renderHook, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import type {MediaDocument, MediaImportProgress} from '@core/schema/mediaEdit';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
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
  useMediaImportCompletion,
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

const queued: MediaImportProgress = {
  mediaId: mediaId(1),
  fileName: 'Invented.mp4',
  phase: 'queued',
  percent: 0,
};
const complete: MediaImportProgress = {
  ...queued,
  phase: 'complete',
  percent: 100,
};

function setupImport() {
  const fixture = mediaFixture(mediaDocument([]));
  const navigate = vi.fn();
  const hook = renderHook(
    () => ({
      track: useMediaImportCompletion(),
      media: useMediaView(),
    }),
    {
      wrapper: ({children}) => (
        <WorkspaceNavigation value={navigate}>
          <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
            {children}
          </MediaViewProvider>
        </WorkspaceNavigation>
      ),
    },
  );
  return {...fixture, ...hook, navigate};
}

describe('media import completion', () => {
  it.each([false, true])(
    'selects the imported item and navigates only on completion, early push=%s',
    async early => {
      const f = setupImport();
      await waitFor(() =>
        expect(f.result.current.media.view.document).not.toBeNull(),
      );
      if (early) {
        act(() => {
          f.pushDocument(mediaDocument([mediaItem(1)], 2));
          f.pushProgress(complete);
        });
      }
      expect(f.navigate).not.toHaveBeenCalled();
      act(() => f.result.current.track([queued]));
      if (!early) {
        expect(f.navigate).not.toHaveBeenCalled();
        act(() => {
          f.pushDocument(mediaDocument([mediaItem(1)], 2));
          f.pushProgress(complete);
        });
      }
      expect(f.navigate).toHaveBeenCalledExactlyOnceWith('prep');
      expect(f.result.current.media.selected).toBe(mediaId(1));
      act(() => f.pushProgress(complete));
      expect(f.navigate).toHaveBeenCalledOnce();
    },
  );

  it.each(['cancel', 'failed', 'cancelled'] as const)(
    'keeps selection and workspace on %s',
    async kind => {
      const f = setupImport();
      await waitFor(() =>
        expect(f.result.current.media.view.document).not.toBeNull(),
      );
      act(() => f.result.current.track(kind === 'cancel' ? [] : [queued]));
      if (kind !== 'cancel') {
        act(() =>
          f.pushProgress(
            kind === 'failed'
              ? {...queued, phase: 'failed', message: 'Invented failure'}
              : {...queued, phase: 'cancelled'},
          ),
        );
      }
      expect(f.navigate).not.toHaveBeenCalled();
      expect(f.result.current.media.selected).toBeNull();
    },
  );

  it('ignores a late reply after unmount', () => {
    const f = setupImport();
    const track = f.result.current.track;
    f.unmount();
    act(() => track([complete]));
    expect(f.navigate).not.toHaveBeenCalled();
  });
});
