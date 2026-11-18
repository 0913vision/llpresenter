import {liveCommands} from '@fixtures/renderer/session/liveCommands';
import {waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {createScreenId, createServiceItemId} from '@core/schema/ids';
import type {ShowService} from '@core/schema/showService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sendLive, startLiveSync, useLive} from '@renderer/session/live';
import {
  applyService,
  openItem,
  outputTile,
  useShow,
} from '@renderer/session/show';

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
};

function setup(value = service) {
  const sent: LiveCommand[] = [];
  const getService = vi.fn(() => Promise.resolve(value));
  window.llp = mockLlpApi({
    service: {get: getService},
    live: {
      send: request => {
        for (const command of liveCommands(request)) {
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
    lastStartedItemId: null,
    commandVersion: 0,
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
      'layer.clear',
      'slide.show',
      'slide.show',
      'layer.clear',
      'slide.show',
      'item.start',
      'layer.clear',
      'slide.show',
      'item.start',
      'layer.clear',
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
    expect(sent.map(command => command.type)).toEqual([
      'layer.clear',
      'slide.show',
    ]);
  });

  it('keeps output working for an untyped projection without sending an invalid start command', () => {
    const {sent} = setup({
      ...service,
      rows: [{kind: 'song', id: 'legacy', title: 'Legacy'}],
      tiles: {legacy: [tile]},
    });
    outputTile({itemId: 'legacy', index: 0});
    expect(sent.map(command => command.type)).toEqual([
      'layer.clear',
      'slide.show',
    ]);
  });

  it('starts before background and lyrics immediately, then avoids an unchanged refresh', async () => {
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
    expect(sent.map(command => command.type)).toEqual([
      'item.start',
      'media.show',
      'slide.show',
    ]);
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

  it('does not send a correction when a previously present tile disappears', async () => {
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
    expect(sent.map(command => command.type)).toEqual([
      'item.start',
      'media.show',
      'slide.show',
    ]);
    finish({...value, revision: 2, tiles: {[first]: [tile]}});
    await waitFor(() => expect(useShow.getState().revision).toBe(2));
    expect(sent.filter(command => command.type === 'slide.show')).toHaveLength(
      1,
    );
    expect(
      sent.slice(3).every(command => command.type === 'stage.next.set'),
    ).toBe(true);
    const count = sent.length;
    expect(useLive.getState().lastStartedItemId).toBe(first);
    outputTile({itemId: first, index: 1});
    expect(sent).toHaveLength(count);
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
      'media.show',
      'slide.show',
      'item.start',
      'layer.clear',
      'slide.show',
    ]);
    expect(useLive.getState().lastStartedItemId).toBe(second);
  });

  it('does not resume an older lookup after a test pattern is shown', async () => {
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
    const refreshed = {
      ...value,
      rows: [
        {
          kind: 'song',
          id: first,
          title: 'First',
          background: {mediaId: 'updated-media', loop: true},
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
    sendLive({
      type: 'live.batch',
      commands: [
        {
          type: 'output.set',
          screenId: '00000000-0000-4000-8000-000000000001',
          on: true,
        },
        {
          type: 'screen.testPattern.set',
          screenId: createScreenId('00000000-0000-4000-8000-000000000001'),
          on: true,
        },
      ],
    });
    const count = sent.length;
    finish(refreshed);
    await waitFor(() => expect(getService).toHaveResolvedTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sent).toHaveLength(count);
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
      expect(useLive.getState().lastStartedItemId).toBe(first),
    );
    outputTile({itemId: first, index: 1});
    expect(sent.map(command => command.type)).toEqual(['slide.show']);
    stop();
  });
});
