import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import type {ItemEditRequest} from '@renderer/features/service/items/itemEditQueue';
import type {ServiceItemState} from '@renderer/features/service/items/serviceItemStore';
import {SongItemDesign} from '@renderer/features/service/items/SongItemDesign';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {isItemOfKind} from '@core/schema/service';
import {createThemeId} from '@core/schema/ids';
import {
  itemFixture,
  fixtureItems,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';

const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};

function setup(readOnly = false) {
  mockMenuRowHeight();
  const fixture = itemFixture();
  const snapshot: ServiceItemState = {
    service: null,
    item: null,
    song: null,
    songStatus: null,
    position: 0,
    bibleSelection: [],
    cardSelected: false,
    busy: false,
  };
  const mockItems = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    submitItemEdit: vi
      .fn<(request: ItemEditRequest) => Promise<boolean>>()
      .mockResolvedValue(true),
  };
  const mockSession = {
    readOnly,
    flush: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
  const view = render(
    <SongItemDesign
      api={fixture.api}
      items={mockItems}
      session={mockSession}
      title="새 노래"
      target={target}
      disabled={false}
    />,
  );
  return {...fixture, ...view, mockItems, mockSession, user: userEvent.setup()};
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('waits for pending lyrics before submitting theme and background changes to the captured item', async () => {
  const f = setup();
  let finish: ((value: boolean) => void) | undefined;
  f.mockSession.flush.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const theme = await screen.findByRole('button', {name: '테마'});
  await waitFor(() => expect(theme.getAttribute('aria-disabled')).toBeNull());
  await f.user.click(theme);
  await f.user.click(screen.getByRole('menuitemradio', {name: '말씀'}));
  expect(f.mockItems.submitItemEdit).not.toHaveBeenCalled();
  await act(async () => {
    finish?.(true);
  });
  const themeRequest = f.mockItems.submitItemEdit.mock.calls[0]?.[0];
  expect(themeRequest?.target).toEqual(target);
  const original = f
    .service()
    .service.order.find(item => item.id === target.itemId);
  if (original === undefined || !isItemOfKind(original, 'song')) {
    throw new Error('Missing item');
  }
  const changed = themeRequest?.change(original);
  expect(changed).toMatchObject({
    slides: original.slides,
    memo: '천천히',
    future: {keep: true},
  });
  expect(changed?.theme).toBeDefined();
  await f.user.click(screen.getByRole('button', {name: '배경, 새 노래'}));
  await f.user.click(screen.getByRole('option', {name: /새벽 하늘/}));
  const background = f.mockItems.submitItemEdit.mock.calls[1]?.[0];
  expect(background?.target).toEqual(target);
  expect(background?.change(original)).toMatchObject({
    ...original,
    background: fixtureMedia.dawn,
  });
  await f.user.click(theme);
  await f.user.click(screen.getByRole('menuitemradio', {name: '기본'}));
  expect(
    f.mockItems.submitItemEdit.mock.calls[2]?.[0].change({
      ...original,
      theme: createThemeId('00000000-0000-4000-8000-000000000002'),
    })?.theme,
  ).toBeUndefined();
});

it('refuses an appearance change when the lyric flush fails', async () => {
  const f = setup();
  f.mockSession.flush.mockResolvedValue(false);
  const theme = await screen.findByRole('button', {name: '테마'});
  await waitFor(() => expect(theme.getAttribute('aria-disabled')).toBeNull());
  await f.user.click(theme);
  await f.user.click(screen.getByRole('menuitemradio', {name: '말씀'}));
  expect(f.mockSession.flush).toHaveBeenCalledOnce();
  expect(f.mockItems.submitItemEdit).not.toHaveBeenCalled();
});

it('keeps read-only items locked and releases its document subscriptions on leaving', async () => {
  const f = setup(true);
  const theme = await screen.findByRole('button', {name: '테마'});
  expect(theme.getAttribute('aria-disabled')).toBe('true');
  await f.user.click(theme);
  expect(screen.queryByRole('menu')).toBeNull();
  expect(f.serviceListeners()).toBe(1);
  f.unmount();
  expect(f.serviceListeners()).toBe(0);
  expect(f.mockItems.submitItemEdit).not.toHaveBeenCalled();
});

it('updates the selected item from pushes and stops offering a deleted item', async () => {
  const f = setup();
  await screen.findByRole('button', {name: '테마'});
  act(() =>
    f.pushService({
      ...f.service(),
      revision: 4,
      service: {
        ...f.service().service,
        order: f
          .service()
          .service.order.map(item =>
            item.id === target.itemId
              ? {...item, background: fixtureMedia.warm}
              : item,
          ),
      },
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '배경, 새 노래'}).textContent,
    ).toContain('따뜻한 빛'),
  );
  act(() =>
    f.pushService({
      ...f.service(),
      revision: 5,
      service: {...f.service().service, order: []},
    }),
  );
  expect(screen.queryByRole('button', {name: '테마'})).toBeNull();
});
