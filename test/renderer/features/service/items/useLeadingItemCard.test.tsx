import {act, renderHook, waitFor} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {sectionCardOf} from '@core/services/sectionCards';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {saveCard} from '@renderer/features/service/items/sectionCardActions';
import {useLeadingItemCard} from '@renderer/features/service/items/useLeadingItemCard';

it('binds the leading card to the selected item and deletes only that card', async () => {
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  const view = renderHook(() =>
    useLeadingItemCard(items, fixtureItems.arranged),
  );
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
  expect(view.result.current).toBeUndefined();
  const section = SUNDAY_SECTIONS[1];
  if (section === undefined) throw Error('missing section');
  act(() => saveCard(items, sectionCardOf(section)));
  await waitFor(() => expect(view.result.current).toBeDefined());
  act(() => view.result.current?.onDelete());
  await waitFor(() => expect(view.result.current).toBeUndefined());
  expect(items.getSnapshot().item).not.toHaveProperty('sectionCard');
});
