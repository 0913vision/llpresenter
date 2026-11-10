import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {createSlideId} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {useShow} from '@renderer/session/show';
import {
  itemFixture,
  fixtureItems,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {fixtureMedia} from '@fixtures/core/mediaList';

vi.mock('@renderer/features/songs/editor/SongPreview', () => ({
  Picture: () => <div />,
}));
afterEach(() => useShow.setState({serviceId: null, openItemId: null}));

it.each(['blank', 'ad'] as const)(
  'shows %s slide bands and opens the clicked slide editor',
  async form => {
    const f = itemFixture();
    const item = newSlidesItem(form, fixtureItems.plain);
    const first = item.slides.slides[0];
    if (first === undefined) throw new Error('Missing first slide');
    const updated = {
      ...item,
      slides: {
        ...item.slides,
        name: '이번 순서',
        slides: [
          {
            ...first,
            text: '첫 줄\n다음 줄',
            ...(form === 'ad' ? {name: '소식 이름'} : {}),
          },
          {
            id: createSlideId('00000000-0000-4000-8000-000000000099'),
            media: fixtureMedia.warm,
          },
        ],
      },
    };
    f.pushService({
      ...f.service(),
      service: {...f.service().service, order: [updated]},
    });
    useShow.setState({serviceId: fixtureServiceId, openItemId: updated.id});
    const editor = new SongEditorStore(f.api, vi.fn());
    const items = new ServiceItemStore(f.api, editor, vi.fn());
    const open = vi
      .spyOn(f.api.slidesEditor, 'open')
      .mockResolvedValue({ok: true, value: undefined});
    const view = render(
      <DetailsPanel
        sizeClass="normal"
        target={{kind: 'item', itemId: updated.id}}
        api={f.api}
        items={items}
        editor={editor}
      />,
    );
    try {
      await screen.findByText('이번 순서');
      await userEvent.click(screen.getByRole('tab', {name: '슬라이드'}));
      const grid = screen.getByRole('listbox', {name: '슬라이드'});
      const firstTile = await within(grid).findByRole('option', {
        name: form === 'ad' ? '1 소식 이름' : '1 첫 줄',
      });
      await within(grid).findByRole('option', {name: '2 a.png'});
      await userEvent.dblClick(firstTile);
      await waitFor(() =>
        expect(open).toHaveBeenCalledWith({
          serviceId: fixtureServiceId,
          itemId: updated.id,
        }),
      );
    } finally {
      view.unmount();
      items.dispose();
      await editor.dispose();
    }
  },
);
