import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {Channels, type LlpApi} from '@shared/ipc';
import {emptyLiveState} from '@shared/live';

type Handler = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  handlers: new Map<string, (event: unknown, value: unknown) => void>(),
  send: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => {
      electron.exposed.set(key, api);
    },
  },
  ipcRenderer: {
    send: electron.send,
    invoke: electron.invoke,
    on: (channel: string, handler: Handler) => {
      electron.handlers.set(channel, handler);
    },
    removeListener: (channel: string) => {
      electron.handlers.delete(channel);
    },
  },
}));

let api: LlpApi;

beforeAll(async () => {
  await import('./index');
  const exposed = electron.exposed.get('llp');
  if (!isLlpApi(exposed)) {
    throw new Error('The preload did not expose window.llp');
  }
  api = exposed;
});

beforeEach(() => {
  electron.send.mockClear();
  electron.invoke.mockReset();
});

function isLlpApi(value: unknown): value is LlpApi {
  return typeof value === 'object' && value !== null && 'ui' in value;
}

function showService(revision: number) {
  return {
    revision,
    id: 'service-1',
    name: '주일 예배',
    readOnly: false,
    rows: [{kind: 'song', id: 'item-1', title: '만복의 근원 하나님'}],
    tiles: {
      'item-1': [
        {label: '1절', labelColor: 'teal', lines: ['만복의 근원 하나님']},
      ],
    },
    jumpKeys: {Digit1: '1절'},
  };
}

function loggedErrors(): unknown[] {
  return electron.send.mock.calls
    .filter(([channel]) => channel === Channels.logWrite)
    .map(([, entry]: unknown[]) => entry);
}

describe('preload', () => {
  it('passes a valid UI state through', async () => {
    const state = {layout: {normal: {left: 280, right: 480}}};
    electron.invoke.mockResolvedValueOnce(state);

    await expect(api.ui.get()).resolves.toEqual(state);
    expect(electron.invoke).toHaveBeenCalledWith(Channels.uiGet);
    expect(loggedErrors()).toEqual([]);
  });

  it.each([
    ['a width that is text', {layout: {normal: {left: 'bad'}}}],
    ['a layout that is an array', {layout: []}],
    ['no reply', undefined],
  ])('logs a UI state with %s and rejects', async (_name, reply) => {
    electron.invoke.mockResolvedValueOnce(reply);

    await expect(api.ui.get()).rejects.toThrow(
      `Bad reply on ${Channels.uiGet}`,
    );
    expect(loggedErrors()).toEqual([expect.objectContaining({level: 'error'})]);
  });

  it('logs a failed UI state call and rejects', async () => {
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.ui.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toEqual([
      expect.objectContaining({detail: 'no handler'}),
    ]);
  });

  it('puts the failing field before the message in the log detail', async () => {
    electron.invoke.mockResolvedValueOnce({layout: {normal: {left: 'bad'}}});

    await expect(api.ui.get()).rejects.toThrow('layout.normal.left: ');

    expect(JSON.stringify(loggedErrors())).toContain(
      '"detail":"layout.normal.left: ',
    );
  });

  it('logs a malformed or failed live state reply and rejects', async () => {
    electron.invoke.mockResolvedValueOnce({version: 'one'});
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.live.get()).rejects.toThrow(
      `Bad reply on ${Channels.liveGet}`,
    );
    await expect(api.live.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toHaveLength(2);
  });

  it('passes a valid live state through', async () => {
    electron.invoke.mockResolvedValueOnce({...emptyLiveState(), version: 4});

    await expect(api.live.get()).resolves.toEqual({
      ...emptyLiveState(),
      version: 4,
    });
    expect(loggedErrors()).toEqual([]);
  });

  it('passes only valid pushed states to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.live.subscribe(listener);
    const push = electron.handlers.get(Channels.liveChanged);

    push?.({}, {...emptyLiveState(), version: 3});
    push?.({}, {version: -1});

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({...emptyLiveState(), version: 3});
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(Channels.liveChanged)).toBe(false);
  });

  it('passes a valid service, and no service, through', async () => {
    electron.invoke.mockResolvedValueOnce(showService(2));
    electron.invoke.mockResolvedValueOnce(null);

    await expect(api.service.get()).resolves.toEqual(showService(2));
    await expect(api.service.get()).resolves.toBeNull();
    expect(electron.invoke).toHaveBeenCalledWith(Channels.serviceGet);
    expect(loggedErrors()).toEqual([]);
  });

  it('logs a malformed or failed service reply and rejects, never null', async () => {
    electron.invoke.mockResolvedValueOnce({...showService(2), rows: 'none'});
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.service.get()).rejects.toThrow(
      `Bad reply on ${Channels.serviceGet}: rows`,
    );
    await expect(api.service.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toHaveLength(2);
  });

  it('passes only valid pushed services to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.service.subscribe(listener);
    const push = electron.handlers.get(Channels.serviceChanged);

    push?.({}, showService(3));
    push?.({}, null);
    push?.({}, {...showService(4), revision: -1});

    expect(listener.mock.calls).toEqual([[showService(3)], [null]]);
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(Channels.serviceChanged)).toBe(false);
  });

  it('passes valid output statuses through and rejects bad ones', async () => {
    const statuses = {
      main: {
        placement: 'window',
        renderer: 'restarting',
        fps: null,
        fpsLow: false,
      },
    };
    electron.invoke.mockResolvedValueOnce(statuses);
    electron.invoke.mockResolvedValueOnce({main: {placement: 'hidden'}});

    await expect(api.output.getStatus()).resolves.toEqual(statuses);
    await expect(api.output.getStatus()).rejects.toThrow(
      `Bad reply on ${Channels.outputStatusGet}`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(Channels.outputStatusGet);
    expect(loggedErrors()).toHaveLength(1);
  });

  it('passes only valid pushed output statuses to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.output.subscribeStatus(listener);
    const push = electron.handlers.get(Channels.outputStatusChanged);

    push?.({}, {});
    push?.({}, []);

    expect(listener.mock.calls).toEqual([[{}]]);
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(Channels.outputStatusChanged)).toBe(false);
  });

  it('sends 다시 시도 for a screen one way', () => {
    api.output.retry('main');

    expect(electron.send).toHaveBeenCalledWith(Channels.outputRetry, {
      screenId: 'main',
    });
  });

  it('sends layout changes, log entries, and frame rates one way', () => {
    const change = {sizeClass: 'normal', left: 280, right: 480} as const;
    const entry = {level: 'error', message: 'render failed'} as const;
    const report = {screenId: 'main', fps: 60};

    api.ui.setLayout(change);
    api.log.write(entry);
    api.output.reportFrameRate(report);

    expect(electron.send).toHaveBeenCalledWith(Channels.uiLayoutSet, change);
    expect(electron.send).toHaveBeenCalledWith(Channels.logWrite, entry);
    expect(electron.send).toHaveBeenCalledWith(
      Channels.outputFrameRate,
      report,
    );
  });
});
