import {render, waitFor} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {ItemPreviewPanel} from '@renderer/features/service/items/ItemSidePanels';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {SongPreviewFrame} from '@renderer/features/songs/editor/SongPreview';
import {itemPicture} from '@renderer/features/songs/editor/songItemModel';
import {useShow} from '@renderer/session/show';

vi.mock(
  '@renderer/features/songs/editor/SongPreview',
  async importOriginal => ({
    ...(await importOriginal<
      typeof import('@renderer/features/songs/editor/SongPreview')
    >()),
    SongPreviewFrame: vi.fn(() => null),
  }),
);
vi.mock(
  '@renderer/features/songs/editor/songItemModel',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@renderer/features/songs/editor/songItemModel')
      >();
    return {...actual, itemPicture: vi.fn(actual.itemPicture)};
  },
);

describe('ItemPreviewPanel', () => {
  it('pictures the place the item has selected, in the arrangement it plays', async () => {
    const fixture = itemFixture();
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    useShow.setState({
      serviceId: fixtureServiceId,
      openItemId: fixtureItems.arranged,
    });
    const view = render(<ItemPreviewPanel items={items} editor={editor} />);
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      useShow.setState({serviceId: null, openItemId: null});
      await editor.dispose();
    });
    await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    const {arrangement, position, song} = items.getSnapshot();

    await waitFor(() =>
      expect(itemPicture).toHaveBeenLastCalledWith({
        song: song?.history.snapshot.song,
        arrangement,
        position,
        background: song?.background,
      }),
    );
    expect(vi.mocked(SongPreviewFrame).mock.lastCall?.[0].item).toMatchObject({
      id: fixtureItems.arranged,
      kind: 'song',
      source: 'service',
    });
  });
});
