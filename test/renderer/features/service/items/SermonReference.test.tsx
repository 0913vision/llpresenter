import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {displayReference} from '@core/bible/displayReference';
import {isItemOfKind} from '@core/schema/service';
import {templateOrder} from '@fixtures/core/serviceList';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SermonInlineEditor} from '@renderer/features/service/items/SermonInlineEditor';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';

it('edits the displayed passage reference through shared undo and redo', async () => {
  const fixture = itemFixture();
  const bible = templateOrder.find(item => isItemOfKind(item, 'bible'));
  if (!bible || !isItemOfKind(bible, 'bible')) throw Error('Missing passage');
  const item = {
    id: fixtureItems.plain,
    sermon: {title: 'Sermon', passage: bible.bible},
  };
  const document = fixture.service();
  fixture.pushService({
    ...document,
    service: {...document.service, order: [item]},
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: item.id});
  const view = render(<SermonInlineEditor items={items} />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  const field = await screen.findByRole('textbox', {name: '본문 주소'});
  expect(field).toHaveProperty('value', displayReference(bible.bible.ref));
  const user = userEvent.setup();
  await user.clear(field);
  await user.type(field, 'Custom reference');
  await user.tab();
  await waitFor(() =>
    expect(fixture.service().service.order[0]).toMatchObject({
      sermon: {reference: 'Custom reference', passage: bible.bible},
    }),
  );
  await act(() => items.replayItemEdit('undo'));
  await waitFor(() =>
    expect(fixture.service().service.order[0]).not.toHaveProperty(
      'sermon.reference',
    ),
  );
  await act(() => items.replayItemEdit('redo'));
  await waitFor(() =>
    expect(fixture.service().service.order[0]).toMatchObject({
      sermon: {reference: 'Custom reference'},
    }),
  );
});
