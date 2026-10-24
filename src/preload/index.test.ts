import {beforeAll, describe, expect, it, vi} from 'vitest';
import {Channels, type LlpApi} from '@shared/ipc';

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
    on: vi.fn(),
    removeListener: vi.fn(),
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

function isLlpApi(value: unknown): value is LlpApi {
  return typeof value === 'object' && value !== null && 'ui' in value;
}

describe('preload', () => {
  it('reads the UI state with an invoke', async () => {
    electron.invoke.mockResolvedValueOnce({});

    await expect(api.ui.get()).resolves.toEqual({});
    expect(electron.invoke).toHaveBeenCalledWith(Channels.uiGet);
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
