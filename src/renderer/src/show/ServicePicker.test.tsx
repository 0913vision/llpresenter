import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ServiceEntry} from '@shared/schema/contentDocuments';
import {createServiceId} from '@shared/schema/ids';
import type {ShowService} from '@shared/schema/showService';
import type {ServiceOpenRequest} from '@shared/schema/serviceOpen';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {applyService, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {ServiceOrderHeader} from './ServiceOrderHeader';

const first = createServiceId('00000000-0000-4000-8000-000000000001');
const second = createServiceId('00000000-0000-4000-8000-000000000002');
const third = createServiceId('00000000-0000-4000-8000-000000000003');
const entries: readonly ServiceEntry[] = [
  {id: third, name: '수요 예배', date: '2026-10-24T11:00', access: 'readOnly'},
  {id: first, name: '주일 예배', date: '2026-10-25T11:00', access: 'editable'},
  {id: second, name: '저녁 예배', date: '2026-10-26T19:00', access: 'editable'},
];
function projection(id: string = first): ShowService {
  return {
    id,
    revision: 1,
    name: entries.find(entry => entry.id === id)?.name ?? '',
    readOnly: entries.find(entry => entry.id === id)?.access === 'readOnly',
    rows: [],
    tiles: {},
    jumpKeys: {},
  };
}
function setup() {
  applyService(null);
  applyService(projection());
  const live = emptyLiveState();
  useLive.setState({state: live, lastSlideItemId: null});
  let push: (entries: readonly ServiceEntry[]) => void = () => undefined;
  const stopList = vi.fn();
  const send = vi.fn();
  const api = fakeLlpApi({
    live: {send},
    services: {
      list: () => Promise.resolve(entries),
      subscribeList: listener => {
        push = listener;
        return stopList;
      },
    },
    service: {
      open: vi.fn(({serviceId}: ServiceOpenRequest) =>
        Promise.resolve(projection(serviceId)),
      ),
    },
  });
  window.llp = api;
  const onProblem = vi.fn();
  const view = render(<ServiceOrderHeader onProblem={onProblem} />);
  return {
    api,
    view,
    live,
    send,
    stopList,
    onProblem,
    user: userEvent.setup(),
    push: (value: readonly ServiceEntry[]) => push(value),
  };
}
async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(screen.getByRole('button', {name: '주일 예배'}));
  await screen.findAllByRole('menuitemradio');
}
afterEach(() => {
  delete window.llp;
  applyService(null);
});

describe('service picker', () => {
  it('sorts by latest date, checks the current service, filters names, and restores focus on Esc', async () => {
    const {user, stopList} = setup();
    await user.tab();
    await user.keyboard('{ArrowDown}');
    await screen.findAllByRole('menuitemradio');
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows[0]?.textContent).toContain('저녁 예배');
    expect(rows[0]?.textContent).toContain('10월 26일');
    expect(rows[1]?.getAttribute('aria-checked')).toBe('true');
    expect(rows[2]?.textContent).toContain('수요 예배');
    await user.type(screen.getByRole('combobox'), '저녁');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '주일 예배'}),
    );
    expect(stopList).toHaveBeenCalledOnce();
  });

  it('opens a service through the merged contract without sending output commands', async () => {
    const {api, user, live, send} = setup();
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /저녁 예배/}));
    await waitFor(() => expect(useShow.getState().serviceId).toBe(second));
    expect(api.service.open).toHaveBeenCalledWith({serviceId: second});
    expect(useLive.getState().state).toBe(live);
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('leaves the current service and output intact when an id is no longer installed', async () => {
    const {api, user, live, onProblem, send} = setup();
    vi.spyOn(api.service, 'open').mockResolvedValueOnce(null);
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /저녁 예배/}));
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({key: 'service-picker:missing'}),
      ),
    );
    expect(useShow.getState().serviceId).toBe(first);
    expect(useLive.getState().state).toBe(live);
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores the current choice and permits opening read-only services', async () => {
    const {api, user} = setup();
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /주일 예배/}));
    expect(api.service.open).not.toHaveBeenCalled();
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /수요 예배/}));
    await waitFor(() => expect(useShow.getState().serviceId).toBe(third));
    expect(useShow.getState().readOnly).toBe(true);
  });

  it('allows choosing an installed service when none is open', async () => {
    const {user} = setup();
    act(() => applyService(null));
    await user.click(screen.getByRole('button', {name: '예배 순서'}));
    await screen.findAllByRole('menuitemradio');
    await user.click(screen.getByRole('menuitemradio', {name: /저녁 예배/}));
    await waitFor(() => expect(useShow.getState().serviceId).toBe(second));
  });

  it('keeps a pushed list over a slower initial read and releases it on unmount', async () => {
    const {api, user, push, stopList, view} = setup();
    let finish: (entries: readonly ServiceEntry[]) => void = () => undefined;
    vi.spyOn(api.services, 'list').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await user.click(screen.getByRole('button', {name: '주일 예배'}));
    act(() => push(entries.filter(entry => entry.id !== third)));
    await screen.findAllByRole('menuitemradio');
    await act(async () => {
      finish(entries);
      await Promise.resolve();
    });
    expect(screen.queryByRole('menuitemradio', {name: /수요 예배/})).toBeNull();
    view.unmount();
    expect(stopList).toHaveBeenCalledOnce();
  });

  it('does not let an older open response overwrite another service push or accept duplicate clicks', async () => {
    const {api, user} = setup();
    let finish: (value: ShowService) => void = () => undefined;
    vi.spyOn(api.service, 'open').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /저녁 예배/}));
    await user.click(screen.getByRole('button', {name: '주일 예배'}));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(api.service.open).toHaveBeenCalledOnce();
    act(() => applyService(projection(third)));
    await act(async () => {
      finish(projection(second));
      await Promise.resolve();
    });
    expect(useShow.getState().serviceId).toBe(third);
  });

  it('reports rejected opens with their cause and keeps the current service', async () => {
    const {api, user, onProblem} = setup();
    vi.spyOn(api.service, 'open').mockRejectedValueOnce(
      new Error('Open failed'),
    );
    const log = vi.spyOn(api.log, 'write');
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /저녁 예배/}));
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(log.mock.calls[0]?.[0].detail).toBe('Open failed');
    expect(useShow.getState().serviceId).toBe(first);
  });

  it('reports a list-read failure to the same host', async () => {
    const {api, user, onProblem} = setup();
    vi.spyOn(api.services, 'list').mockRejectedValueOnce(
      new Error('Read failed'),
    );
    await user.click(screen.getByRole('button', {name: '주일 예배'}));
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({key: 'service-picker:load'}),
      ),
    );
  });
});
