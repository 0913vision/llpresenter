import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {uiEndpoints} from '@contracts/ipc/ui';
import {makeTempDir} from '../../../test/temp-dir';
import type {Logger} from '../log';
import {openAppConfig} from './appConfigFile';
import {registerUiZoom, type ZoomControl} from './uiZoom';
import {writeJson} from './testFiles';

type Handler = (
  event: {readonly sender: {readonly id: number}},
  value?: unknown,
) => unknown;
const electron = vi.hoisted(() => ({handlers: new Map<string, Handler>()}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      electron.handlers.set(channel, handler),
    removeHandler: (channel: string) => electron.handlers.delete(channel),
  },
}));

class Control extends EventEmitter implements ZoomControl {
  readonly isDestroyed = vi.fn(() => false);
  readonly setZoomMode = vi.fn<(mode: 'isolated') => void>();
  readonly setZoomFactor = vi.fn<(factor: number) => void>();
  constructor(readonly id: number) {
    super();
  }
}

const disposers: Array<() => Promise<void>> = [];
beforeEach(() => electron.handlers.clear());
afterEach(async () => {
  for (const dispose of disposers.splice(0)) await dispose();
});

async function setUp(percent = 120) {
  const file = join(await makeTempDir(), 'app.json');
  await writeJson(file, {
    format: 'llapp',
    schemaVersion: 1,
    uiZoomPercent: percent,
  });
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
  const config = await openAppConfig({file, log});
  const zoom = registerUiZoom(config, log);
  disposers.push(async () => {
    zoom.dispose();
    await config.flush();
    config.dispose();
  });
  const control = new Control(1);
  zoom.attachControl(control);
  return {file, config, zoom, control, log};
}

async function ask(
  channel: string,
  senderId: number,
  value?: unknown,
): Promise<unknown> {
  const handler = electron.handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing handler ${channel}`);
  return handler({sender: {id: senderId}}, value);
}

describe('control UI zoom', () => {
  it('reapplies reset to every control even when the stored value is already 100', async () => {
    const {control, zoom, config} = await setUp(100);
    const second = new Control(2);
    zoom.attachControl(second);
    control.setZoomFactor.mockClear();
    second.setZoomFactor.mockClear();

    await expect(
      ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomReset'}),
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
    await expect(ask(uiEndpoints.getZoom.channel, control.id)).resolves.toBe(
      150,
    );

    await ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomIn'});
    control.emit('did-finish-load');

    expect(control.setZoomFactor).toHaveBeenLastCalledWith(1.6);
    await config.flush();
    const restored = await openAppConfig({
      file: config.file,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        flush: () => Promise.resolve(),
      },
    });
    expect(restored.uiZoomPercent).toBe(160);
    restored.dispose();
  });

  it('clamps bursts using main state and resets at either limit', async () => {
    const {control, config} = await setUp();
    await Promise.all(
      Array.from({length: 20}, () =>
        ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomIn'}),
      ),
    );
    expect(config.uiZoomPercent).toBe(200);
    expect(control.setZoomFactor).toHaveBeenLastCalledWith(2);
    await expect(
      ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomReset'}),
    ).resolves.toBe(100);
    await Promise.all(
      Array.from({length: 20}, () =>
        ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomOut'}),
      ),
    );
    expect(config.uiZoomPercent).toBe(100);
    await expect(
      ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomReset'}),
    ).resolves.toBe(100);
    await expect(
      ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomIn'}),
    ).resolves.toBe(110);
  });

  it('updates attached control windows and never touches an output window', async () => {
    const {control, zoom, config} = await setUp();
    const preferences = new Control(2);
    const output = new Control(3);
    zoom.attachControl(preferences);

    await ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomIn'});

    expect(control.setZoomFactor).toHaveBeenLastCalledWith(1.3);
    expect(preferences.setZoomFactor).toHaveBeenLastCalledWith(1.3);
    expect(output.setZoomMode).not.toHaveBeenCalled();
    expect(output.setZoomFactor).not.toHaveBeenCalled();
    await expect(
      ask(uiEndpoints.changeZoom.channel, output.id, {type: 'ui.zoomIn'}),
    ).rejects.toThrow('Only control windows');
    await expect(ask(uiEndpoints.getZoom.channel, output.id)).rejects.toThrow(
      'Only control windows',
    );
    expect(config.uiZoomPercent).toBe(130);
  });

  it.each([undefined, null, 'ui.zoomIn', [], {type: 'other'}, {type: 1}])(
    'logs and drops malformed IPC %j',
    async value => {
      const {control, config, log} = await setUp();
      await expect(
        ask(uiEndpoints.changeZoom.channel, control.id, value),
      ).rejects.toThrow('Invalid UI zoom command');
      expect(config.uiZoomPercent).toBe(120);
      expect(control.setZoomFactor).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledTimes(1);
    },
  );

  it('releases handlers and window listeners on destruction and disposal', async () => {
    const {control, zoom} = await setUp();
    control.emit('destroyed');
    expect(control.listenerCount('did-finish-load')).toBe(0);
    expect(control.listenerCount('destroyed')).toBe(0);
    await expect(ask(uiEndpoints.getZoom.channel, control.id)).rejects.toThrow(
      'Only control windows',
    );
    const other = new Control(2);
    zoom.attachControl(other);

    zoom.dispose();

    expect(electron.handlers.size).toBe(0);
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
      ask(uiEndpoints.changeZoom.channel, control.id, {type: 'ui.zoomIn'}),
    ).resolves.toBe(130);
    expect(log.error).toHaveBeenCalledWith(
      'could not apply control window zoom',
      expect.any(Error),
    );
    control.emit('did-finish-load');
    expect(control.setZoomFactor).toHaveBeenLastCalledWith(1.3);
  });
});
