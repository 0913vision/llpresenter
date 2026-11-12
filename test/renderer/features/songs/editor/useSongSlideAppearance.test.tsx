import {act, renderHook} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {LIGHT_SONG_THEME_ID} from '@core/themes/lightSong';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {createSongId} from '@core/schema/ids';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {
  itemFixture,
  fixtureItems,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {useSongSlideAppearance} from '@renderer/features/songs/editor/useSongSlideAppearance';
import {useShow} from '@renderer/session/show';
vi.mock('@renderer/platform/useSlideTheme', () => ({
  useSlideTheme: vi.fn(() => ({background: fixtureMedia.dawn})),
}));
it('prioritizes the service item override for items and the library draft for library songs', () => {
  const fixture = itemFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  const previous = useShow.getState();
  onTestFinished(() => {
    useShow.setState(previous);
    return store.dispose();
  });
  act(() => store.open(fixture.first));
  const librarySession = store.getSnapshot().session;
  if (librarySession === null) throw new Error('Missing library session');
  act(() => librarySession.setBackground(fixtureMedia.warm));
  const library = renderHook(() => useSongSlideAppearance(librarySession));
  expect(library.result.current?.background).toBe(fixtureMedia.warm);
  library.unmount();
  act(() => {
    useShow.setState({
      rows: [
        {
          kind: 'song',
          id: fixtureItems.arranged,
          title: 'song',
          background: {mediaId: fixtureMedia.dawn, loop: true},
        },
      ],
    });
    const document = {
      ...fixture.first,
      itemTarget: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      song: {
        ...fixture.first.song,
        id: createSongId(fixtureItems.arranged),
        background: fixtureMedia.warm,
      },
    };
    store.open(document, {content: fixture.api.content});
  });
  const itemSession = store.getSnapshot().session;
  if (itemSession === null) throw new Error('Missing item session');
  const item = renderHook(() => useSongSlideAppearance(itemSession));
  expect(item.result.current?.background).toBe(fixtureMedia.dawn);
});

it('passes a library song theme to the shared slide appearance', () => {
  const fixture = itemFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  act(() =>
    store.open({
      ...fixture.first,
      song: {...fixture.first.song, theme: LIGHT_SONG_THEME_ID},
    }),
  );
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('Missing library session');
  renderHook(() => useSongSlideAppearance(session));
  expect(useSlideTheme).toHaveBeenLastCalledWith(
    expect.objectContaining({theme: LIGHT_SONG_THEME_ID}),
    'service',
  );
});
