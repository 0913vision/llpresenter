import {useSyncExternalStore} from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {sectionCardOf} from '@core/services/sectionCards';
import {ItemCardRow} from '@renderer/features/service/items/ItemCardRow';
import {setItemCard} from '@renderer/features/service/items/cardSlideModel';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';

it('keeps the checkbox in step with card edits and writes to the same item', async () => {
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  function Row() {
    const {item, busy} = useSyncExternalStore(
      items.subscribe,
      items.getSnapshot,
    );
    return item === null ? null : (
      <ItemCardRow
        items={items}
        item={item}
        reason={busy ? '저장 중' : undefined}
      />
    );
  }
  const view = render(<Row />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  const checkbox = await screen.findByRole('checkbox', {
    name: '구역 이름 슬라이드',
  });
  expect(checkbox.getAttribute('aria-checked')).toBe('false');
  await userEvent.click(checkbox);
  await waitFor(() =>
    expect(checkbox.getAttribute('aria-checked')).toBe('true'),
  );
  const section = SUNDAY_SECTIONS[1];
  if (section === undefined) throw Error('missing section');
  await act(async () => {
    await items.submitItemEdit({
      target: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      failure: 'failed',
      change: current => setItemCard(current, sectionCardOf(section)),
    });
  });
  expect(checkbox.getAttribute('aria-checked')).toBe('true');
  await userEvent.click(checkbox);
  await waitFor(() =>
    expect(checkbox.getAttribute('aria-checked')).toBe('false'),
  );
  expect(items.getSnapshot().item).not.toHaveProperty('sectionCard');
  await act(async () => {
    await items.submitItemEdit({
      target: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      failure: 'failed',
      change: current => setItemCard(current, sectionCardOf(section)),
    });
  });
  await waitFor(() =>
    expect(checkbox.getAttribute('aria-checked')).toBe('true'),
  );
  await act(async () => {
    await items.submitItemEdit({
      target: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      failure: 'failed',
      change: current => setItemCard(current, undefined),
    });
  });
  await waitFor(() =>
    expect(checkbox.getAttribute('aria-checked')).toBe('false'),
  );
});
