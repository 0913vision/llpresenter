import {parseServiceDocument} from '@core/schema/contentDocuments';
import {createThemeId} from '@core/schema/ids';
import {act, render, waitFor} from '@testing-library/react';
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
  it('pictures the place the item has selected, in its independent deck', async () => {
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
    const {position, song} = items.getSnapshot();

    await waitFor(() =>
      expect(itemPicture).toHaveBeenLastCalledWith({
        song: song?.history.snapshot.song,
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

it('previews the second Bible verse after an opening card', async () => {
  const fixture = itemFixture();
  const current = fixture.service();
  const candidate = parseServiceDocument({
    ...current,
    service: {
      ...current.service,
      order: [
        {
          id: fixtureItems.arranged,
          sectionCard: {
            name: 'Section',
            english: 'Section',
            theme: '00000000-0000-4000-8000-000000000111',
          },
          bible: {
            translation: 'sample',
            ref: 'John 3:16-17',
            split: 'verse',
            reference: 'every',
            verseNumbers: true,
            translationName: false,
          },
        },
      ],
    },
  });
  if (!candidate.ok || candidate.value === null) throw Error('invalid fixture');
  fixture.pushService(candidate.value);
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  const card = {
    name: 'Section',
    english: 'Section',
    theme: createThemeId('00000000-0000-4000-8000-000000000111'),
  };
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
    tiles: {
      [fixtureItems.arranged]: [
        {
          label: 'Section',
          labelColor: 'none',
          lines: ['Section'],
          sectionCard: card,
        },
        {label: '3:16', labelColor: 'none', lines: ['First']},
        {label: '3:17', labelColor: 'none', lines: ['Second']},
      ],
    },
  });
  const view = render(<ItemPreviewPanel items={items} editor={editor} />);
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    useShow.setState({serviceId: null, openItemId: null});
    await editor.dispose();
  });
  await waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
  act(() => items.selectPosition(2));
  await waitFor(() =>
    expect(
      vi.mocked(SongPreviewFrame).mock.lastCall?.[0].picture,
    ).toMatchObject({tile: {label: '3:17'}, position: 3, total: 3}),
  );
});
