import {describe, expect, it, vi} from 'vitest';
import {UpdateController} from '@main/update/controller';
import type {UpdaterPort} from '@main/update/port';
import type {UpdateAction, UpdateSnapshot} from '@core/schema/update';
import {recordingLogger} from '@fixtures/main/displays/testing';

function setup() {
  let outputsOn = false;
  const updater = {
    check: vi.fn<UpdaterPort['check']>().mockResolvedValue('0.60.0'),
    download: vi.fn<UpdaterPort['download']>().mockResolvedValue(),
    install: vi.fn(),
    dispose: vi.fn(),
  } satisfies UpdaterPort;
  const installAfterShutdown = vi.fn(async (install: () => void) => {
    install();
    return true;
  });
  const options = {
    updater,
    version: '0.59.0',
    outputsOn: () => outputsOn,
    changed: vi.fn<(snapshot: UpdateSnapshot) => void>(),
    installAfterShutdown,
    log: recordingLogger(),
  };
  const controller = new UpdateController(options);
  const act = (action: UpdateAction['action']): void =>
    controller.act({action, revision: controller.get().revision});
  return {
    controller,
    updater,
    options,
    act,
    live: (on: boolean) => {
      outputsOn = on;
      controller.outputsChanged();
    },
  };
}

describe('UpdateController', () => {
  it('checks only once at launch, silently downloads, then offers the version', async () => {
    const {controller, updater, options} = setup();
    controller.launch();
    controller.launch();
    expect(controller.get().visible).toBe(false);
    await vi.waitFor(() =>
      expect(controller.get().status.kind).toBe('downloaded'),
    );
    expect(updater.check).toHaveBeenCalledOnce();
    expect(updater.download).toHaveBeenCalledOnce();
    expect(
      options.changed.mock.calls
        .slice(0, -1)
        .every(([state]) => !state.visible),
    ).toBe(true);
    expect(controller.get()).toMatchObject({
      visible: true,
      status: {version: '0.60.0'},
    });
  });

  it.each(['latest', 'offline'] as const)(
    'keeps launch %s silent',
    async outcome => {
      const {controller, updater} = setup();
      if (outcome === 'latest') updater.check.mockResolvedValue(null);
      else updater.check.mockRejectedValue(new Error('ENOTFOUND'));
      await controller.check(false);
      expect(controller.get().visible).toBe(false);
      expect(updater.download).not.toHaveBeenCalled();
    },
  );

  it('requires a manual download click and publishes percentage progress', async () => {
    const {controller, updater, act, options} = setup();
    updater.download.mockImplementation(async progress => {
      progress(42);
    });
    await controller.check();
    expect(controller.get().status.kind).toBe('available');
    expect(updater.download).not.toHaveBeenCalled();
    act('download');
    await vi.waitFor(() =>
      expect(controller.get().status.kind).toBe('downloaded'),
    );
    expect(
      options.changed.mock.calls.some(
        ([state]) =>
          state.status.kind === 'downloading' && state.status.percent === 42,
      ),
    ).toBe(true);
  });

  it('gives a busy notice without starting another check', async () => {
    const {controller, updater} = setup();
    let finish: (value: string | null) => void = () => undefined;
    updater.check.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    controller.launch();
    await controller.check();
    expect(controller.get()).toMatchObject({visible: true, busy: true});
    expect(updater.check).toHaveBeenCalledOnce();
    finish(null);
    await vi.waitFor(() =>
      expect(controller.get().status).toEqual({
        kind: 'latest',
        version: '0.59.0',
      }),
    );
  });

  it('reports the current version for a manual latest result', async () => {
    const {controller, updater} = setup();
    updater.check.mockResolvedValue(null);
    await controller.check();
    expect(controller.get()).toMatchObject({
      visible: true,
      status: {kind: 'latest', version: '0.59.0'},
    });
  });

  it.each(['check', 'download'] as const)(
    'reports a plain manual %s error',
    async operation => {
      const {controller, updater, act} = setup();
      updater[operation].mockRejectedValue(
        new Error('net::ERR_INTERNET_DISCONNECTED'),
      );
      await controller.check();
      if (operation === 'download') act('download');
      await vi.waitFor(() =>
        expect(controller.get()).toMatchObject({
          visible: true,
          status: {
            kind: 'error',
            reason: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
          },
        }),
      );
    },
  );

  it('retains the install question while output is on and rejects forged install clicks', async () => {
    const {controller, updater, act, live} = setup();
    live(true);
    await controller.check(false);
    expect(controller.get()).toMatchObject({
      outputsOn: true,
      visible: true,
      status: {kind: 'downloaded'},
    });
    act('install');
    expect(updater.install).not.toHaveBeenCalled();
    live(false);
    expect(controller.get()).toMatchObject({outputsOn: false, visible: true});
    act('install');
    await vi.waitFor(() => expect(updater.install).toHaveBeenCalledOnce());
  });

  it('allows a manual download during output without installing', async () => {
    const {controller, updater, act, live} = setup();
    live(true);
    await controller.check();
    expect(controller.get().status.kind).toBe('available');
    act('download');
    await vi.waitFor(() =>
      expect(controller.get().status.kind).toBe('downloaded'),
    );
    expect(updater.install).not.toHaveBeenCalled();
  });

  it('later never installs on dispose and manual check offers the cached download again', async () => {
    const {controller, updater, act} = setup();
    await controller.check(false);
    act('later');
    expect(controller.get().visible).toBe(false);
    await controller.check();
    expect(controller.get()).toMatchObject({
      visible: true,
      status: {kind: 'downloaded'},
    });
    expect(updater.check).toHaveBeenCalledOnce();
    act('later');
    controller.dispose();
    expect(updater.install).not.toHaveBeenCalled();
  });

  it('rejects stale actions and restores the question when shutdown is cancelled', async () => {
    const {controller, options, updater, act, live} = setup();
    await controller.check(false);
    const revision = controller.get().revision;
    live(true);
    live(false);
    controller.act({action: 'install', revision});
    expect(updater.install).not.toHaveBeenCalled();
    options.installAfterShutdown.mockResolvedValue(false);
    act('install');
    await vi.waitFor(() =>
      expect(controller.get()).toMatchObject({
        visible: true,
        status: {kind: 'downloaded'},
      }),
    );
  });

  it('does not check for disabled builds or after disposal', async () => {
    const {options} = setup();
    const controller = new UpdateController({...options, updater: null});
    controller.launch();
    expect(options.updater.check).not.toHaveBeenCalled();
    await controller.check();
    expect(controller.get().status.kind).toBe('unsupported');
    controller.dispose();
    controller.launch();
    expect(options.updater.check).not.toHaveBeenCalled();
  });
});
