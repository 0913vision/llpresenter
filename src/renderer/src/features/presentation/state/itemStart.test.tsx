import {act, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {createServiceItemId} from '@core/schema/ids';
import type {ShowService} from '@core/schema/showService';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import {sendLive, startLiveSync, useLive} from '../../../platform/live';
import {applyService, openItem, outputTile, useShow} from './show';

const first = createServiceItemId('10000000-0000-4000-8000-000000000001');
const second = createServiceItemId('10000000-0000-4000-8000-000000000002');
const third = createServiceItemId('10000000-0000-4000-8000-000000000003');
const tile = {
  label: null,
  labelColor: 'none',
  lines: ['Invented words'],
} as const;
const service: ShowService = {
  id: '00000000-0000-4000-8000-000000000001',
  revision: 1,
  name: 'Invented service',
  readOnly: false,
  rows: [
    {kind: 'song', id: first, title: 'First'},
    {kind: 'song', id: second, title: 'Second'},
    {kind: 'bible', id: third, title: 'Third'},
  ],
  tiles: {
    [first]: [tile, tile],
    [second]: [tile],
    [third]: [tile],
    quick: [tile],
  },
  jumpKeys: {},
};

function setup(value = service) {
  const sent: LiveCommand[] = [];
  const getService = vi.fn(() => Promise.resolve(value));
  window.llp = fakeLlpApi({
    service: {get: getService},
    live: {
      send: command => {
        sent.push(command);
        const state = useLive.getState().state ?? emptyLiveState();
        if (command.type === 'slide.show') {
          useLive.setState({
            state: {
              ...state,
              version: state.version + 1,
              layers: {...state.layers, slide: command.slide},
            },
          });
        }
        if (
          command.type === 'layer.clear' &&
          ['slide', 'all'].includes(command.target)
        ) {
          useLive.setState({
            state: {
              ...state,
              version: state.version + 1,
              layers: {...state.layers, slide: null},
            },
          });
        }
      },
    },
  });
  applyService(value);
  return {sent, getService};
}

beforeEach(() => {
  applyService(null);
  useLive.setState({
    state: null,
    lastSlideItemId: null,
    commandVersion: 0,
    startedItemIds: new Set(),
  });
});
afterEach(() => {
  delete window.llp;
});

describe('starting a service item', () => {
  it('starts once before its first slide, keeps that identity through clears, and restarts on return', () => {
    const {sent} = setup();
    openItem(first);
    expect(sent).toEqual([]);
    outputTile({itemId: first, index: 0});
    outputTile({itemId: first, index: 1});
    sendLive({type: 'layer.clear', target: 'slide'});
    outputTile({itemId: first, index: 0});
    outputTile({itemId: second, index: 0});
    outputTile({itemId: first, index: 1});
    expect(sent.map(command => command.type)).toEqual([
      'item.start',
      'slide.show',
      'slide.show',
      'layer.clear',
      'slide.show',
      'item.start',
      'slide.show',
      'item.start',
      'slide.show',
    ]);
    expect(sent.filter(command => command.type === 'item.start')).toEqual([
      {type: 'item.start', itemId: first},
      {type: 'item.start', itemId: second},
      {type: 'item.start', itemId: first},
    ]);
  });

  it('does not start absent tiles or quick slides without a service row', () => {
    const {sent} = setup();
    outputTile({itemId: first, index: 99});
    expect(sent).toEqual([]);
    outputTile({itemId: 'quick', index: 0});
    expect(sent.map(command => command.type)).toEqual(['slide.show']);
  });

  it('keeps output working for an untyped projection without sending an invalid start command', () => {
    const {sent} = setup({
      ...service,
      rows: [{kind: 'song', id: 'legacy', title: 'Legacy'}],
      tiles: {legacy: [tile]},
    });
    outputTile({itemId: 'legacy', index: 0});
    expect(sent.map(command => command.type)).toEqual(['slide.show']);
  });

  it('starts before background and lyrics after a successful asynchronous refresh', async () => {
    const {sent, getService} = setup({
      ...service,
      rows: [
        {
          kind: 'song',
          id: first,
          title: 'First',
          background: {mediaId: 'invented-media', loop: true},
        },
      ],
    });
    outputTile({itemId: first, index: 0});
    expect(sent).toEqual([]);
    await waitFor(() =>
      expect(sent.map(command => command.type)).toEqual([
        'item.start',
        'media.show',
        'slide.show',
      ]),
    );
    outputTile({itemId: first, index: 1});
    expect(getService).toHaveBeenCalledOnce();
    expect(sent.at(-1)?.type).toBe('slide.show');
  });

  it('sends no start, background, or slide when the refreshed tile disappeared', async () => {
    const value = {
      ...service,
      rows: [
        {
          kind: 'song',
          id: first,
          title: 'First',
          background: {mediaId: 'invented-media', loop: true},
        },
      ],
    } satisfies ShowService;
    const {sent, getService} = setup(value);
    let finish: (value: ShowService) => void = () => undefined;
    getService.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    outputTile({itemId: first, index: 1});
    finish({...value, revision: 2, tiles: {[first]: [tile]}});
    await waitFor(() => expect(useShow.getState().revision).toBe(2));
    expect(sent).toEqual([]);
    expect(useLive.getState().startedItemIds.size).toBe(0);
  });

  it('does not start an item after a newer output supersedes its pending lookup', async () => {
    const value = {
      ...service,
      rows: [
        {
          kind: 'song',
          id: first,
          title: 'First',
          background: {mediaId: 'invented-media', loop: true},
        },
        ...service.rows.slice(1),
      ],
    } satisfies ShowService;
    const {sent, getService} = setup(value);
    let finish: (value: ShowService) => void = () => undefined;
    getService.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    outputTile({itemId: first, index: 0});
    outputTile({itemId: second, index: 0});
    finish(value);
    await waitFor(() => expect(getService).toHaveResolvedTimes(1));
    expect(sent.map(command => command.type)).toEqual([
      'item.start',
      'slide.show',
    ]);
    expect(useLive.getState().startedItemIds.has(first)).toBe(false);
    expect(useLive.getState().startedItemIds.has(second)).toBe(true);
  });

  it('remembers the current item from the initial live feed without starting it again', async () => {
    const {sent} = setup();
    const base = emptyLiveState();
    if (window.llp === undefined) throw new Error('Missing API');
    vi.spyOn(window.llp.live, 'get').mockResolvedValue({
      ...base,
      layers: {
        ...base.layers,
        slide: {itemId: first, position: 0, label: null, lines: ['Kept live']},
      },
    });
    const stop = startLiveSync();
    await waitFor(() =>
      expect(useLive.getState().startedItemIds.has(first)).toBe(true),
    );
    outputTile({itemId: first, index: 1});
    expect(sent.map(command => command.type)).toEqual(['slide.show']);
    stop();
  });

  it('caps remembered items and retains their identity on repeated starts', () => {
    setup();
    useLive.setState({
      startedItemIds: new Set(
        Array.from({length: 10_000}, (_, index) => `old-${index}`),
      ),
    });
    sendLive({type: 'item.start', itemId: first});
    const ids = useLive.getState().startedItemIds;
    expect(ids.size).toBe(10_000);
    expect(ids.has('old-0')).toBe(false);
    expect(ids.has(first)).toBe(true);
    sendLive({type: 'item.start', itemId: first});
    expect(useLive.getState().startedItemIds).toBe(ids);
  });
});

describe('service row progress', () => {
  it('dims only started items above the current item, follows reorder, and keeps progress through clear', () => {
    setup();
    render(<ServiceOrderList />);
    act(() => {
      outputTile({itemId: first, index: 0});
      outputTile({itemId: third, index: 0});
    });
    const row = (title: string) => screen.getByRole('option', {name: title});
    expect(row('First').dataset['state']).toContain('done');
    expect(row('Second').dataset['state']).toBeUndefined();
    expect(row('Third').dataset['state']).toContain('live');
    act(() => sendLive({type: 'layer.clear', target: 'slide'}));
    expect(row('First').dataset['state']).toContain('done');
    expect(row('Third').dataset['state']).toBeUndefined();
    act(() =>
      applyService({
        ...service,
        revision: 2,
        rows: [...service.rows].reverse(),
      }),
    );
    expect(row('First').dataset['state']).toBeUndefined();
  });
});
