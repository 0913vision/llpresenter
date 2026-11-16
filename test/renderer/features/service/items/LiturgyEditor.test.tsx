import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {newLiturgyItem} from '@core/services/liturgy';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {
  LiturgyEditor,
  LiturgyVersion,
} from '@renderer/features/service/items/LiturgyEditor';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';

it.each(['creed', 'prayer'] as const)(
  'edits the %s version without creating generic slides or changing output',
  async kind => {
    const fixture = itemFixture();
    const send = vi.spyOn(fixture.api.live, 'send');
    const document = fixture.service();
    const item = newLiturgyItem(fixtureItems.plain, {kind, translation: 'new'});
    fixture.pushService({
      ...document,
      service: {...document.service, order: [item]},
    });
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    items.show({serviceId: fixtureServiceId, itemId: item.id});
    const view = render(
      <>
        <LiturgyEditor items={items} />
        <LiturgyVersion
          items={items}
          item={item}
          serviceId={fixtureServiceId}
          locked={false}
        />
      </>,
    );
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
    });
    expect(
      await screen.findAllByRole('textbox', {name: /\uc608\uc2dd\ubb38/}),
    ).not.toHaveLength(0);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {name: '예식문 버전'}));
    await user.click(screen.getByRole('menuitemradio', {name: '옛 번역'}));
    await waitFor(() =>
      expect(fixture.service().service.order[0]).toMatchObject({
        liturgy: {kind, translation: 'old'},
      }),
    );
    expect(fixture.service().service.order[0]).not.toHaveProperty('slides');
    expect(send).not.toHaveBeenCalled();
  },
);
