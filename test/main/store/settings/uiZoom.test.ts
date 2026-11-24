import {EventEmitter} from 'node:events';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {uiEndpoints} from '@contracts/ipc/ui';
import type {Logger} from '@main/base/log';
import {registerUiZoom, type ZoomControl} from '@main/store/settings/uiZoom';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const send = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send},
      },
    ],
  },
  ipcMain: ipc.ipcMain,
}));

class Control extends EventEmitter implements ZoomControl {
  readonly isDestroyed = vi.fn(() => false);
  readonly setZoomMode = vi.fn<(mode: 'isolated') => void>();
  readonly setZoomFactor = vi.fn<(factor: number) => void>();
  constructor(readonly id: number) {
    super();
  }
}

const disposers: Array<() => void> = [];
beforeEach(() => {
  ipc.handlers.clear();
  send.mockClear();
});
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

function mockConfig(percent: number) {
  const config = {
    uiZoomPercent: percent,
    setUiZoomPercent: vi.fn((next: number) => {
      config.uiZoomPercent = next;
    }),
  };
  return config;
}

async function setUp(percent = 120) {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
  const config = mockConfig(percent);
  const zoom = registerUiZoom(config, log);
  disposers.push(() => zoom.dispose());
  const control = new Control(1);
  zoom.attachControl(control);
  return Promise.resolve({config, zoom, control, log});
}

describe('control UI zoom', () => {
  it('sets a chosen step, applies it, and tells every window', async () => {
    const {control, config} = await setUp(100);

    await expect(
      ipc.invoke(
        uiEndpoints.changeZoom,
        {
          type: 'ui.zoomSet',
          percent: 140,
        },
        control,
      ),
    ).resolves.toBe(140);

    expect(config.setUiZoomPercent).toHaveBeenCalledExactlyOnceWith(140);
    expect(control.setZoomFactor).toHaveBeenLastCalledWith(1.4);
    expect(send).toHaveBeenCalledExactlyOnceWith(
      uiEndpoints.zoomChanged.channel,
      140,
    );
  });

  it.each([90, 105, 210, '140', null])(
    'refuses to set the zoom to %j',
    async percent => {
      const {control, config} = await setUp(100);

      await expect(
        ipc.invoke(
          uiEndpoints.changeZoom,
          {
            type: 'ui.zoomSet',
            percent,
          },
          control,
        ),
      ).rejects.toThrow('Malformed ui:zoom:set request');

      expect(config.setUiZoomPercent).not.toHaveBeenCalled();
    },
  );

  it('reapplies reset to every control even when the stored value is already 100', async () => {
    const {control, zoom, config} = await setUp(100);
    const second = new Control(2);
    zoom.attachControl(second);
    control.setZoomFactor.mockClear();
    second.setZoomFactor.mockClear();

    await expect(
      ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomReset'}, control),
    ).resolves.toBe(100);

    expect(control.setZoomFactor).toHaveBeenCalledExactlyOnceWith(1);
    expect(second.setZoomFactor).toHaveBeenCalledExactlyOnceWith(1);
    expect(config.uiZoomPercent).toBe(100);
  });

  it('applies stored zoom after isolation and reapplies it after navigation', async () => {
    const {control, config} = await setUp(150);
    expect(control.setZoomMode).toHaveBeenCalledWith('isolated');
    expect(control.setZoomMode.mock.invocationCallOrder[0]).toBeLessThan(
      control.setZoomFactor.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(control.setZoomFactor).toHaveBeenCalledWith(1.5);
    await expect(
      ipc.invoke(uiEndpoints.getZoom, undefined, {id: control.id}),
    ).resolves.toBe(150);

    await ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomIn'}, control);
    control.emit('did-finish-load');

    expect(control.setZoomFactor).toHaveBeenLastCalledWith(1.6);
    expect(config.setUiZoomPercent).toHaveBeenLastCalledWith(160);
  });

  it('clamps bursts using main state and resets at either limit', async () => {
    const {control, config} = await setUp();
    await Promise.all(
      Array.from({length: 20}, () =>
        ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomIn'}, control),
      ),
    );
    expect(config.uiZoomPercent).toBe(200);
    expect(control.setZoomFactor).toHaveBeenLastCalledWith(2);
    await expect(
      ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomReset'}, control),
    ).resolves.toBe(100);
    await Promise.all(
      Array.from({length: 20}, () =>
        ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomOut'}, control),
      ),
    );
    expect(config.uiZoomPercent).toBe(100);
    await expect(
      ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomReset'}, control),
    ).resolves.toBe(100);
    await expect(
      ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomIn'}, control),
    ).resolves.toBe(110);
  });

  it('updates attached control windows and never touches an output window', async () => {
    const {control, zoom, config} = await setUp();
    const preferences = new Control(2);
    const output = new Control(3);
    zoom.attachControl(preferences);

    await ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomIn'}, control);

    expect(control.setZoomFactor).toHaveBeenLastCalledWith(1.3);
    expect(preferences.setZoomFactor).toHaveBeenLastCalledWith(1.3);
    expect(output.setZoomMode).not.toHaveBeenCalled();
    expect(output.setZoomFactor).not.toHaveBeenCalled();
    await expect(
      ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomIn'}, output),
    ).rejects.toThrow('Only control windows');
    await expect(
      ipc.invoke(uiEndpoints.getZoom, undefined, {id: output.id}),
    ).rejects.toThrow('Only control windows');
    expect(config.uiZoomPercent).toBe(130);
  });

  it.each([{type: 'other'}])('logs and drops malformed IPC %j', async value => {
    const {control, config, log} = await setUp();
    await expect(
      ipc.invoke(uiEndpoints.changeZoom, value, control),
    ).rejects.toThrow('Malformed ui:zoom:set request');
    expect(config.uiZoomPercent).toBe(120);
    expect(control.setZoomFactor).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('releases handlers and window listeners on destruction and disposal', async () => {
    const {control, zoom} = await setUp();
    control.emit('destroyed');
    expect(control.listenerCount('did-finish-load')).toBe(0);
    expect(control.listenerCount('destroyed')).toBe(0);
    await expect(
      ipc.invoke(uiEndpoints.getZoom, undefined, {id: control.id}),
    ).rejects.toThrow('Only control windows');
    const other = new Control(2);
    zoom.attachControl(other);

    zoom.dispose();

    expect(ipc.open()).toBe(0);
    expect(other.listenerCount('did-finish-load')).toBe(0);
    expect(other.listenerCount('destroyed')).toBe(0);
  });

  it('does not apply zoom when isolation fails', async () => {
    const {zoom, log} = await setUp();
    const failed = new Control(2);
    failed.setZoomMode.mockImplementation(() => {
      throw new Error('isolation failed');
    });

    expect(() => zoom.attachControl(failed)).not.toThrow();

    expect(failed.setZoomFactor).not.toHaveBeenCalled();
    expect(failed.listenerCount('did-finish-load')).toBe(0);
    expect(log.error).toHaveBeenCalledWith(
      'could not isolate control window zoom',
      expect.any(Error),
    );
  });

  it('logs a failed native zoom and retries on the next load without throwing', async () => {
    const {control, log} = await setUp();
    control.setZoomFactor.mockImplementationOnce(() => {
      throw new Error('native zoom failed');
    });

    await expect(
      ipc.invoke(uiEndpoints.changeZoom, {type: 'ui.zoomIn'}, control),
    ).resolves.toBe(130);
    expect(log.error).toHaveBeenCalledWith(
      'could not apply control window zoom',
      expect.any(Error),
    );
    control.emit('did-finish-load');
    expect(control.setZoomFactor).toHaveBeenLastCalledWith(1.3);
  });
});
