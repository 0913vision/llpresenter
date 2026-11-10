import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {ShowService} from '@core/schema/showService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sendLive, startLiveSync, useLive} from '@renderer/session/live';
import {
  applyService,
  outputNext,
  outputPrevious,
  outputTile,
  useShow,
} from '@renderer/session/show';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';

const START = 1000;
const background = {mediaId: 'video', loop: true};
const tile = {
  label: 'Verse',
  labelColor: 'none',
  lines: ['Test lyrics'],
} as const;
const service: ShowService = {
  revision: 1,
  id: 'service',
  name: 'Test service',
  readOnly: false,
  rows: [
    {kind: 'song', id: 'one', title: 'One', background},
    {kind: 'song', id: 'two', title: 'Two', background},
    {kind: 'song', id: 'none', title: 'No background'},
    {kind: 'bible', id: 'bible', title: 'Passage'},
  ],
  tiles: {
    one: [tile, tile, tile],
    two: [tile],
    none: [tile],
    bible: [tile],
    quick: [tile],
  },
  jumpKeys: {},
};

let now: number;
let live: LiveState;

function reduce(state: LiveState, command: LiveCommand): LiveState {
  const next = {...state, version: state.version + 1};
  const {layers} = state;
  if (command.type === 'live.batch') {
    return command.commands.reduce(reduce, state);
  }
  if (command.type === 'slide.show') {
    return {...next, layers: {...layers, slide: command.slide}};
  }
  if (command.type === 'media.show') {
    if (
      layers.media?.mediaId === command.media.mediaId &&
      layers.media.loop === command.media.loop
    ) {
      return next;
    }
    return {
      ...next,
      layers: {...layers, media: {...command.media, startedAt: now}},
    };
  }
  if (command.type === 'layer.clear') {
    const clears = (layer: string) => ['all', layer].includes(command.target);
    return {
      ...next,
      layers: {
        ...layers,
        slide: clears('slide') ? null : layers.slide,
        media: clears('media') ? null : layers.media,
      },
    };
  }
  if (command.type === 'output.set') {
    return {
      ...next,
      outputs: {...state.outputs, [command.screenId]: command.on},
    };
  }
  return next;
}

const store = {
  get state(): LiveState {
    return live;
  },
  dispatch(command: LiveCommand): void {
    live = reduce(live, command);
  },
};
const sent: LiveCommand[] = [];
const getService = vi.fn<() => Promise<ShowService | null>>();
const log = vi.fn();

function click(itemId: string, index = 0): void {
  outputTile({itemId, index});
}

async function expectSlide(itemId: string, position = 0): Promise<void> {
  await vi.waitFor(() =>
    expect(store.state.layers.slide).toMatchObject({itemId, position}),
  );
}

beforeEach(() => {
  now = START;
  live = emptyLiveState();
  sent.length = 0;
  getService.mockReset().mockResolvedValue(service);
  log.mockReset();
  useLive.setState({
    state: store.state,
    lastStartedItemId: null,
    commandVersion: 0,
  });
  applyService(null);
  applyService(service);
  window.llp = mockLlpApi({
    live: {
      get: async () => store.state,
      send: command => {
        sent.push(command);
        store.dispatch(command);
        useLive.setState({state: store.state});
      },
      subscribe: () => () => undefined,
    },
    service: {get: getService, subscribe: () => () => undefined},
    log: {write: log},
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete window.llp;
});

describe('song backgrounds on output', () => {
  it('keeps the same media object and start time when another song uses it', async () => {
    click('one');
    await expectSlide('one');
    const playing = store.state.layers.media;
    now += 10_000;
    sent.length = 0;
    click('two');
    await expectSlide('two');
    expect(
      sent
        .filter(command => command.type !== 'stage.next.set')
        .map(command => command.type),
    ).toEqual(['live.batch']);
    expect(store.state.layers.media).toBe(playing);
    expect(store.state.layers.media?.startedAt).toBe(START);
  });

  it('preserves a background-only macro choice during same-item navigation', async () => {
    click('one');
    await expectSlide('one');
    sendLive({type: 'media.show', media: {mediaId: 'manual', loop: false}});
    const playing = store.state.layers.media;
    sent.length = 0;
    outputNext();
    outputPrevious();
    outputTile({itemId: 'one', index: 0});
    expect(sent.map(command => command.type)).toEqual([
      'live.batch',
      'live.batch',
      'live.batch',
    ]);
    expect(store.state.layers.media).toBe(playing);
    expect(getService).toHaveBeenCalledTimes(1);
  });

  it.each(['none', 'bible', 'quick'])(
    'removes the previous background for a backgroundless %s',
    async itemId => {
      click('one');
      await expectSlide('one');
      sent.length = 0;
      click(itemId);
      expect(sent).toHaveLength(1);
      expect(store.state.layers.slide?.itemId).toBe(itemId);
      expect(store.state.layers.media).toBeNull();
    },
  );

  it('rechecks a deleted background, clears unrelated media, and shows the problem', async () => {
    sendLive({type: 'media.show', media: {mediaId: 'previous', loop: true}});
    getService.mockResolvedValue({
      ...service,
      revision: 2,
      rows: [
        {kind: 'song', id: 'one', title: 'One', problem: 'missing-background'},
      ],
    });
    sent.length = 0;
    click('one');
    await expectSlide('one');
    expect(store.state.layers.media).toBeNull();
    expect(sent.map(command => command.type)).toEqual(['live.batch']);
    expect(useShow.getState().rows[0]).toMatchObject({
      problem: 'missing-background',
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('rechecks a previously missing background when it is restored', async () => {
    applyService({
      ...service,
      rows: [
        {kind: 'song', id: 'one', title: 'One', problem: 'missing-background'},
      ],
    });
    getService.mockResolvedValue({...service, revision: 2});
    click('one');
    await expectSlide('one');
    expect(store.state.layers.media?.mediaId).toBe('video');
    expect(useShow.getState().rows[0]).not.toHaveProperty('problem');
  });

  it('does not output late after a clear command', async () => {
    let finish: (value: ShowService) => void = () => undefined;
    getService.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    click('one');
    sendLive({type: 'layer.clear', target: 'all'});
    finish(service);
    await vi.waitFor(() => expect(getService).toHaveResolvedTimes(1));
    expect(sent.map(command => command.type)).toEqual(['layer.clear']);
    expect(store.state.layers.slide).toBeNull();
    expect(store.state.layers.media).toBeNull();
  });

  it('allows an output toggle while the song background lookup is pending', async () => {
    let finish: (value: ShowService) => void = () => undefined;
    getService.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    click('one');
    sendLive({type: 'output.set', screenId: MAIN_SCREEN, on: true});
    finish(service);
    await expectSlide('one');
    expect(store.state.outputs[MAIN_SCREEN]).toBe(true);
    expect(store.state.layers.media?.mediaId).toBe('video');
  });

  it('remembers an authoritative item after its lyrics are cleared', async () => {
    const subscribe =
      vi.fn<NonNullable<typeof window.llp>['live']['subscribe']>();
    window.llp = mockLlpApi({
      live: {
        get: async () => emptyLiveState(),
        send: command => sent.push(command),
        subscribe,
      },
    });
    const unsubscribe = vi.fn();
    subscribe.mockReturnValue(unsubscribe);
    const stop = startLiveSync();
    try {
      const accept = subscribe.mock.calls[0]?.[0];
      if (accept === undefined) throw new Error('Missing live subscription');
      const live = {
        ...emptyLiveState(),
        version: 10,
        layers: {
          ...emptyLiveState().layers,
          slide: {itemId: 'one', position: 0, label: null, lines: []},
        },
      };
      accept(live);
      accept({...emptyLiveState(), version: 11});
      await Promise.resolve();
      click('one', 1);
      expect(sent.map(command => command.type)).toEqual(['live.batch']);
      expect(getService).not.toHaveBeenCalled();
    } finally {
      stop();
    }
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('drops a lookup from another service', async () => {
    getService.mockResolvedValue({...service, id: 'other'});
    click('one');
    await vi.waitFor(() => expect(getService).toHaveResolvedTimes(1));
    expect(sent).toEqual([]);
    expect(useShow.getState().serviceId).toBe('service');
  });

  it('uses the cached item background when the lookup fails', async () => {
    sendLive({type: 'media.show', media: {mediaId: 'previous', loop: true}});
    getService.mockRejectedValue(new Error('IPC failed'));
    click('one');
    await expectSlide('one');
    expect(store.state.layers.media?.mediaId).toBe('video');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({level: 'warn'}));
  });

  it('bounds a stuck lookup and outputs the cached item background', async () => {
    vi.useFakeTimers();
    getService.mockImplementation(() => new Promise(() => undefined));
    click('one');
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent.map(command => command.type)).toEqual(['live.batch']);
    expect(store.state.layers.media?.mediaId).toBe('video');
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({detail: 'Song lookup timed out'}),
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
