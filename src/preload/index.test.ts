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
  ])('logs a UI state with %s and gives the defaults', async (_name, reply) => {
    electron.invoke.mockResolvedValueOnce(reply);

    await expect(api.ui.get()).resolves.toEqual({});
    expect(loggedErrors()).toEqual([expect.objectContaining({level: 'error'})]);
  });

  it('logs a failed UI state call and gives the defaults', async () => {
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.ui.get()).resolves.toEqual({});
    expect(loggedErrors()).toEqual([
      expect.objectContaining({detail: 'no handler'}),
    ]);
  });

  it('puts the failing field before the message in the log detail', async () => {
    electron.invoke.mockResolvedValueOnce({layout: {normal: {left: 'bad'}}});

    await api.ui.get();

    expect(JSON.stringify(loggedErrors())).toContain(
      '"detail":"layout.normal.left: ',
    );
  });

  it('logs a malformed live state and gives the empty state', async () => {
    electron.invoke.mockResolvedValueOnce({version: 'one'});

    await expect(api.live.get()).resolves.toEqual(emptyLiveState());
    expect(loggedErrors()).toHaveLength(1);
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
