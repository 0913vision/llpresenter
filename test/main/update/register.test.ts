import {describe, expect, it, vi, afterEach} from 'vitest';
import {registerUpdates, updatesAllowed} from '@main/update/register';
import {LiveStore} from '@main/live/store';
import {recordingLogger} from '@fixtures/main/displays/testing';

type Handler = (event: unknown, ...args: unknown[]) => unknown;
const fake = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  signals: new Map<string, Handler>(),
  updater: {
    check: vi.fn<() => Promise<string | null>>(),
    download: vi.fn<() => Promise<void>>(),
    install: vi.fn(),
    dispose: vi.fn(),
  },
  create: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      fake.handlers.set(channel, handler),
    removeHandler: (channel: string) => fake.handlers.delete(channel),
    on: (channel: string, handler: Handler) =>
      fake.signals.set(channel, handler),
    removeListener: (channel: string) => fake.signals.delete(channel),
  },
}));
vi.mock('@main/update/electronUpdater', () => ({
  createUpdater: () => {
    fake.create();
    return fake.updater;
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  fake.handlers.clear();
  fake.signals.clear();
});

function setup(enabled = true) {
  let ready: (value: boolean) => void = () => undefined;
  const promise = new Promise<boolean>(resolve => {
    ready = resolve;
  });
  fake.updater.check.mockResolvedValue(null);
  const control = {
    webContents: {mainFrame: {}, isDestroyed: () => false, send: vi.fn()},
  };
  const shutdown = {
    quitForUpdate: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
  const stop = registerUpdates({
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
  const event = {
    sender: control.webContents,
    senderFrame: control.webContents.mainFrame,
  };
  return {ready, stop, control, event};
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
    expect(fake.handlers.size).toBe(0);
    expect(fake.signals.size).toBe(0);
    expect(fake.updater.dispose).toHaveBeenCalledOnce();
  });
  it('never constructs the network adapter in dev or test mode', async () => {
    const {ready, stop, event} = setup(false);
    ready(true);
    fake.signals.get('update:check')?.(event);
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
  it('rejects another sender, subframes, extra arguments and malformed actions', () => {
    const {stop, event, control} = setup();
    const events = [
      {sender: {}, senderFrame: {}},
      {...event, senderFrame: {}},
    ];
    for (const bad of events) {
      expect(() => fake.handlers.get('update:get')?.(bad)).toThrow();
      fake.signals.get('update:check')?.(bad);
      fake.signals.get('update:act')?.(bad, {revision: 0, action: 'install'});
    }
    fake.signals.get('update:check')?.(event, 'extra');
    fake.signals.get('update:act')?.(event, {revision: 0, action: 'erase'});
    fake.signals.get('update:act')?.(
      event,
      {revision: 0, action: 'install'},
      'extra',
    );
    expect(fake.updater.check).not.toHaveBeenCalled();
    expect(fake.updater.install).not.toHaveBeenCalled();
    expect(control.webContents.send).not.toHaveBeenCalled();
    stop();
  });
});
