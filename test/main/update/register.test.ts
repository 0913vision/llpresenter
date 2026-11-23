import {describe, expect, it, vi, afterEach} from 'vitest';
import {updateEndpoints} from '@contracts/ipc/update';
import {registerUpdates, updatesAllowed} from '@main/update/register';
import {LiveStore} from '@main/live/store';
import {recordingLogger} from '@fixtures/main/displays/testing';

const fake = vi.hoisted(() => ({
  updater: {
    check: vi.fn<() => Promise<string | null>>(),
    download: vi.fn<() => Promise<void>>(),
    install: vi.fn(),
    dispose: vi.fn(),
  },
  create: vi.fn(),
}));
const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({ipcMain: ipc.ipcMain}));
vi.mock('@main/update/electronUpdater', () => ({
  createUpdater: () => {
    fake.create();
    return fake.updater;
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  ipc.reset();
});

function setup(enabled = true) {
  let ready: (value: boolean) => void = () => undefined;
  const promise = new Promise<boolean>(resolve => {
    ready = resolve;
  });
  fake.updater.check.mockResolvedValue(null);
  const control = {
    webContents: {
      id: 1,
      mainFrame: {},
      isDestroyed: () => false,
      send: vi.fn(),
    },
  };
  const shutdown = {
    quitForUpdate: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
  const stop = registerUpdates({
    prepareRestart: () => Promise.resolve(true),
    cancelRestart: () => Promise.resolve(),
    savePending: () => Promise.resolve(true),
    verifyClean: () => Promise.resolve(true),
    resumeAfterCancelledInstall: vi.fn(),
    control,
    shutdown,
    ready: promise,
    enabled,
    version: '1.0.0',
    log: recordingLogger(),
    store: new LiveStore(),
  });
  return {ready, stop, control, shutdown};
}

describe('update registration', () => {
  it.each([
    {packaged: false, platform: 'win32', testing: false, expected: false},
    {packaged: true, platform: 'darwin', testing: false, expected: false},
    {packaged: true, platform: 'win32', testing: true, expected: false},
    {packaged: true, platform: 'win32', testing: false, expected: true},
  ])(
    'gates packaged=$packaged platform=$platform test=$testing',
    ({expected, ...options}) => {
      expect(updatesAllowed(options)).toBe(expected);
    },
  );
  it('waits for launch readiness, then checks once and removes its handlers', async () => {
    const {ready, stop} = setup();
    expect(fake.updater.check).not.toHaveBeenCalled();
    ready(true);
    await vi.waitFor(() => expect(fake.updater.check).toHaveBeenCalledOnce());
    stop();
    expect(ipc.open()).toBe(0);
    expect(fake.updater.dispose).toHaveBeenCalledOnce();
  });
  it('never constructs the network adapter in dev or test mode', async () => {
    const {ready, stop, control} = setup(false);
    ready(true);
    ipc.send(updateEndpoints.check, undefined, control.webContents);
    await Promise.resolve();
    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.updater.check).not.toHaveBeenCalled();
    stop();
  });
  it('does not launch after cancelled readiness or disposed registration', async () => {
    const first = setup();
    first.ready(false);
    first.stop();
    const second = setup();
    second.stop();
    second.ready(true);
    await Promise.resolve();
    expect(fake.updater.check).not.toHaveBeenCalled();
  });
  it('rejects another window, a frame inside the page, and malformed actions', () => {
    const {stop, control} = setup();
    const install = {revision: 0, action: 'install'};
    const frame = {sender: control.webContents, senderFrame: {}};
    ipc.send(updateEndpoints.check, undefined, {id: 2});
    ipc.send(updateEndpoints.act, install, {id: 2});
    ipc.send(
      updateEndpoints.act,
      {...install, action: 'erase'},
      control.webContents,
    );
    expect(() => ipc.answer(updateEndpoints.get, undefined, {id: 2})).toThrow();
    expect(() =>
      ipc.handlers.get(updateEndpoints.get.channel)?.(frame),
    ).toThrow();
    expect(fake.updater.check).not.toHaveBeenCalled();
    expect(fake.updater.install).not.toHaveBeenCalled();
    expect(control.webContents.send).not.toHaveBeenCalled();
    stop();
  });
});
