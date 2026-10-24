import {EventEmitter} from 'node:events';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../test/temp-dir';

// NOTE(0913vision): Each test imports the whole main process afresh, which
// takes several seconds under coverage on a busy machine.
const ENTRY_TEST_TIMEOUT_MS = 30_000;

const fakes = vi.hoisted(() => {
  const order: string[] = [];
  const opened: {control: unknown} = {control: null};
  const appHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    order,
    appHandlers,
    electron: {
      app: {
        setPath: vi.fn(),
        getPath: vi.fn<(name: string) => string>(),
        getVersion: () => '0.0.0',
        isPackaged: true,
        requestSingleInstanceLock: () => true,
        quit: vi.fn(),
        exit: vi.fn(),
        on: (event: string, handler: (...args: unknown[]) => void) => {
          appHandlers.set(event, [...(appHandlers.get(event) ?? []), handler]);
        },
        whenReady: () => Promise.resolve(),
      },
    },
    uiDispose: vi.fn<() => Promise<void>>(),
    soakStop: vi.fn<() => Promise<void>>(),
    opened,
  };
});

vi.mock('electron', () => fakes.electron);
vi.mock('./uiState/register', () => ({
  registerUiState: vi.fn(async () => {
    fakes.order.push('ui state');
    return {dispose: fakes.uiDispose};
  }),
}));
vi.mock('./soak', () => ({registerSoakRecorder: () => fakes.soakStop}));
vi.mock('./ipc', () => ({registerIpc: () => () => undefined}));
vi.mock('./outputs/start', () => ({startOutputs: () => () => undefined}));
vi.mock('./windows/control', () => ({
  createControlWindow: () => {
    fakes.order.push('control window');
    const win = new EventEmitter();
    fakes.opened.control = win;
    return win;
  },
}));

async function startMain(): Promise<EventEmitter> {
  const before = new Set(process.listeners('uncaughtException'));
  const beforeRejections = new Set(process.listeners('unhandledRejection'));
  onTestFinished(() => {
    for (const listener of process.listeners('uncaughtException')) {
      if (!before.has(listener)) process.off('uncaughtException', listener);
    }
    for (const listener of process.listeners('unhandledRejection')) {
      if (!beforeRejections.has(listener)) {
        process.off('unhandledRejection', listener);
      }
    }
  });
  vi.resetModules();
  await import('./index');
  await vi.waitFor(() => expect(fakes.opened.control).not.toBeNull());
  const control = fakes.opened.control;
  if (!(control instanceof EventEmitter)) throw new Error('no control window');
  return control;
}

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

beforeEach(async () => {
  fakes.electron.app.getPath.mockReturnValue(await makeTempDir());
  fakes.electron.app.quit.mockReset();
  fakes.order.length = 0;
  fakes.appHandlers.clear();
  fakes.opened.control = null;
  fakes.uiDispose.mockReset();
  fakes.soakStop.mockReset();
});

describe('main entry wiring', {timeout: ENTRY_TEST_TIMEOUT_MS}, () => {
  it('reads the UI state before the control window opens', async () => {
    await startMain();
    expect(fakes.order).toEqual(['ui state', 'control window']);
  });

  it('quits only after the UI state and the soak record are written', async () => {
    const ui = deferred();
    const soak = deferred();
    fakes.uiDispose.mockReturnValue(ui.promise);
    fakes.soakStop.mockReturnValue(soak.promise);
    const control = await startMain();
    control.emit('closed');
    ui.resolve();
    await ui.promise;
    expect(fakes.electron.app.quit).not.toHaveBeenCalled();
    soak.resolve();
    await vi.waitFor(() => {
      expect(fakes.electron.app.quit).toHaveBeenCalled();
    });
  });

  it('still quits when saving fails', async () => {
    fakes.uiDispose.mockRejectedValue(new Error('disk full'));
    fakes.soakStop.mockResolvedValue(undefined);
    const control = await startMain();
    control.emit('closed');
    await vi.waitFor(() => {
      expect(fakes.electron.app.quit).toHaveBeenCalled();
    });
  });

  it('leaves quitting to the control window when the last window closes', async () => {
    await startMain();
    for (const handler of fakes.appHandlers.get('window-all-closed') ?? []) {
      handler();
    }
    expect(fakes.appHandlers.get('window-all-closed')).toHaveLength(1);
    expect(fakes.electron.app.quit).not.toHaveBeenCalled();
  });
});
