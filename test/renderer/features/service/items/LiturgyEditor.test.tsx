import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {createThemeId} from '@core/schema/ids';
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

it('can include the title card in a liturgy slide selection', async () => {
  const fixture = itemFixture();
  const item = {
    ...newLiturgyItem(fixtureItems.plain, {kind: 'creed', translation: 'new'}),
    sectionCard: {
      name: '예배 시작',
      english: 'Welcome',
      theme: createThemeId('00000000-0000-4000-8000-000000000111'),
    },
  };
  const document = fixture.service();
  fixture.pushService({
    ...document,
    service: {...document.service, order: [item]},
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: item.id});
  const view = render(<LiturgyEditor items={items} />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  const card = await screen.findByRole('option', {name: '타이틀'});
  const slide = view.container.querySelector('[data-song-slide="0"]');
  if (slide === null) throw new Error('Missing liturgy slide');
  const user = userEvent.setup();
  await user.click(slide);
  await user.keyboard('{Control>}');
  await user.click(card);
  await user.keyboard('{/Control}');
  expect(items.getSnapshot().cardSelected).toBe(true);
  expect(items.getSnapshot().bibleSelection).toEqual([0]);
  expect(card.getAttribute('aria-selected')).toBe('true');
});

it('opens with the title selected and includes it when extending selection', async () => {
  const fixture = itemFixture();
  const item = {
    ...newLiturgyItem(fixtureItems.plain, {kind: 'creed', translation: 'new'}),
    sectionCard: {
      name: 'Welcome',
      english: 'Welcome',
      theme: createThemeId('00000000-0000-4000-8000-000000000111'),
    },
  };
  const document = fixture.service();
  fixture.pushService({
    ...document,
    service: {...document.service, order: [item]},
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: item.id});
  const view = render(<LiturgyEditor items={items} />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  const card = await screen.findByRole('option', {name: '\uD0C0\uC774\uD2C0'});
  const first = view.container.querySelector('[data-song-slide="0"]');
  const second = view.container.querySelector('[data-song-slide="1"]');
  if (first === null || second === null) throw Error('Missing liturgy slides');
  expect(card.getAttribute('aria-selected')).toBe('true');
  expect(first.getAttribute('aria-selected')).toBe('false');
  expect(items.getSnapshot().position).toBe(0);
  await userEvent.keyboard('{Shift>}');
  await userEvent.click(second);
  await userEvent.keyboard('{/Shift}');
  expect(items.getSnapshot().cardSelected).toBe(true);
  expect(items.getSnapshot().bibleSelection).toEqual([0, 1]);
  expect(card.getAttribute('aria-selected')).toBe('true');
});

it('keeps the displayed liturgy section card after the store retargets', async () => {
  const fixture = itemFixture();
  const item = {
    ...newLiturgyItem(fixtureItems.plain, {kind: 'creed', translation: 'new'}),
    sectionCard: {
      name: 'Retained card',
      english: 'Section',
      theme: createThemeId('00000000-0000-4000-8000-000000000111'),
    },
  };
  const document = fixture.service();
  fixture.pushService({
    ...document,
    service: {
      ...document.service,
      order: [
        item,
        ...document.service.order.filter(entry => entry.id !== item.id),
      ],
    },
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: item.id});
  await waitFor(() => expect(items.getSnapshot().item?.id).toBe(item.id));
  const shown = items.getSnapshot();
  const view = render(<LiturgyEditor items={items} shownItem={shown} />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  expect(
    screen.getByRole<HTMLInputElement>('textbox', {
      name: '타이틀',
    }).value,
  ).toBe('Retained card');
  act(() =>
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged}),
  );
  await waitFor(() =>
    expect(items.getSnapshot().item?.id).toBe(fixtureItems.arranged),
  );
  expect(
    screen.getByRole<HTMLInputElement>('textbox', {
      name: '타이틀',
    }).value,
  ).toBe('Retained card');
});

it.each(['creed', 'prayer'] as const)(
  'selects several %s slides for transition editing',
  async kind => {
    const fixture = itemFixture();
    const item = newLiturgyItem(fixtureItems.plain, {kind, translation: 'new'});
    const document = fixture.service();
    fixture.pushService({
      ...document,
      service: {...document.service, order: [item]},
    });
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    items.show({serviceId: fixtureServiceId, itemId: item.id});
    await waitFor(() => expect(items.getSnapshot().item?.id).toBe(item.id));
    const shown = items.getSnapshot();
    const view = render(<LiturgyEditor items={items} shownItem={shown} />);
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
    });
    const rows = await screen.findAllByRole('option');
    const first = rows[0];
    const second = rows[1];
    const third = rows[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Missing liturgy slides');
    }
    const user = userEvent.setup();
    await user.click(first);
    await user.keyboard('{Control>}');
    await user.click(second);
    await user.keyboard('{/Control}');
    expect(items.getSnapshot().bibleSelection).toEqual([0, 1]);
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(second.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Shift>}');
    await user.click(third);
    await user.keyboard('{/Shift}');
    expect(items.getSnapshot().bibleSelection).toEqual([1, 2]);
  },
);
