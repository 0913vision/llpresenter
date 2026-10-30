import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {Channels, type LlpApi} from '@contracts/ipc/api';
import type {ShowService} from '@core/schema/showService';
import {applyService, startServiceSync, useShow} from '@renderer/state/show';

const electron = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
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
    on: () => undefined,
    removeListener: () => undefined,
  },
}));

let preloadApi: LlpApi;

function isLlpApi(value: unknown): value is LlpApi {
  return typeof value === 'object' && value !== null && 'service' in value;
}

beforeAll(async () => {
  await import('../../../preload/index');
  const exposed = electron.exposed.get('llp');
  if (!isLlpApi(exposed)) throw new Error('The preload did not expose llp');
  preloadApi = exposed;
});

const shown: ShowService = {
  revision: 3,
  id: 'sunday',
  name: '주일 예배',
  readOnly: false,
  rows: [{kind: 'song', id: 'a', title: 'A'}],
  tiles: {},
  jumpKeys: {},
};

beforeEach(() => {
  electron.send.mockClear();
  electron.invoke.mockReset();
  window.llp = preloadApi;
  applyService(null);
  applyService(shown);
});

afterEach(() => {
  stopSync();
  delete window.llp;
});

function loggedErrors(): unknown[] {
  const calls: unknown[][] = electron.send.mock.calls;
  return calls
    .filter(([channel]) => channel === Channels.logWrite)
    .map(([, entry]) => entry);
}

let stopSync: () => void = () => undefined;

describe('startServiceSync with the real preload', () => {
  it('keeps the view and logs when the call fails', async () => {
    electron.invoke.mockRejectedValue(new Error('no handler'));
    stopSync = startServiceSync();
    await vi.waitFor(() => expect(loggedErrors()).toHaveLength(1));
    expect(useShow.getState().serviceName).toBe('주일 예배');
  });

  it('keeps the view and logs when the reply is malformed', async () => {
    electron.invoke.mockResolvedValue({revision: 'x'});
    stopSync = startServiceSync();
    await vi.waitFor(() => expect(loggedErrors()).toHaveLength(1));
    expect(useShow.getState().serviceName).toBe('주일 예배');
  });

  it('clears the view when the main process answers that none is open', async () => {
    electron.invoke.mockResolvedValue(null);
    stopSync = startServiceSync();
    await vi.waitFor(() => expect(useShow.getState().serviceId).toBeNull());
    expect(loggedErrors()).toHaveLength(0);
  });

  it('shows a valid reply', async () => {
    electron.invoke.mockResolvedValue({...shown, revision: 4, name: '새 예배'});
    stopSync = startServiceSync();
    await vi.waitFor(() =>
      expect(useShow.getState().serviceName).toBe('새 예배'),
    );
  });
});
