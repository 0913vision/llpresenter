import {EventEmitter} from 'node:events';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import {Channels} from '@contracts/ipc/api';
import {APP_FLUSH_LIMITS} from '@core/schema/appFlush';
import {recordingLogger} from '../displays/testing';
import {registerControlClose, type CloseableWindow} from './controlClose';

const electron = vi.hoisted(() => ({
  ipcMain: new (class {
    readonly listeners = new Map<
      string,
      Set<(event: unknown, value?: unknown) => void>
    >();

    on(channel: string, listener: (event: unknown, value?: unknown) => void) {
      const set = this.listeners.get(channel) ?? new Set();
      set.add(listener);
      this.listeners.set(channel, set);
    }

    removeListener(
      channel: string,
      listener: (event: unknown, value?: unknown) => void,
    ) {
      this.listeners.get(channel)?.delete(listener);
    }

    emit(channel: string, senderId: number, value?: unknown) {
      for (const listener of this.listeners.get(channel) ?? []) {
        listener({sender: {id: senderId}}, value);
      }
    }

    count(): number {
      return [...this.listeners.values()].reduce(
        (total, set) => total + set.size,
        0,
      );
    }
  })(),
}));

vi.mock('electron', () => ({ipcMain: electron.ipcMain}));

const CONTROL_ID = 7;
const OTHER_ID = 8;

class FakeContents extends EventEmitter {
  readonly id = CONTROL_ID;
  destroyed = false;
  readonly send = vi.fn<(channel: string, value: unknown) => void>();

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

class FakeControl extends EventEmitter implements CloseableWindow {
  readonly webContents = new FakeContents();
  destroyed = false;

  isDestroyed(): boolean {
    return this.destroyed;
  }

  close(): void {
    const event = {
      prevented: false,
      preventDefault() {
        event.prevented = true;
      },
    };
    this.emit('close', event);
    if (!event.prevented) this.destroyed = true;
  }
}

function setup() {
  const control = new FakeControl();
  const log = recordingLogger();
  const closing = registerControlClose({control, log});
  onTestFinished(() => {
    closing.dispose();
  });
  const requestId = (index = 0): unknown => {
    const call = control.webContents.send.mock.calls[index];
    if (call?.[0] !== Channels.appFlushRequest) {
      throw new Error('No flush request');
    }
    return Reflect.get(Object(call[1]), 'requestId');
  };
  const reply = (result: boolean, senderId = CONTROL_ID, index = 0) => {
    electron.ipcMain.emit(Channels.appFlushDone, senderId, {
      requestId: requestId(index),
      result,
    });
  };
  return {control, log, closing, requestId, reply};
}

async function settled(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

beforeEach(() => {
  electron.ipcMain.listeners.clear();
});

describe('control window close handshake', () => {
  it('keeps a responsive renderer open through slow saves and times out only after progress stops', async () => {
    const clock = installFakeClock();
    const {control, requestId, reply} = setup();
    control.close();
    const request = {requestId: requestId()};
    for (
      let elapsed = 0;
      elapsed < APP_FLUSH_LIMITS.timeoutMs * 2;
      elapsed += APP_FLUSH_LIMITS.progressIntervalMs
    ) {
      electron.ipcMain.emit(Channels.appFlushProgress, CONTROL_ID, request);
      await clock.advance(APP_FLUSH_LIMITS.progressIntervalMs);
      expect(control.destroyed).toBe(false);
    }
    reply(false);
    await clock.advance(0);
    expect(control.destroyed).toBe(false);
    control.close();
    await clock.advance(APP_FLUSH_LIMITS.timeoutMs);
    expect(control.destroyed).toBe(true);
  });

  it('does not extend a request for progress from another window or request', async () => {
    const clock = installFakeClock();
    const {control, requestId} = setup();
    control.close();
    await clock.advance(APP_FLUSH_LIMITS.timeoutMs - 1);
    electron.ipcMain.emit(Channels.appFlushProgress, OTHER_ID, {
      requestId: requestId(),
    });
    electron.ipcMain.emit(Channels.appFlushProgress, CONTROL_ID, {
      requestId: '00000000-0000-4000-8000-000000000001',
    });
    electron.ipcMain.emit(Channels.appFlushProgress, CONTROL_ID, null);
    await clock.advance(1);
    expect(control.destroyed).toBe(true);
  });
  it('asks the window to flush before it closes and closes after a flushed reply', async () => {
    const {control, reply} = setup();
    control.close();
    expect(control.destroyed).toBe(false);
    expect(control.webContents.send).toHaveBeenCalledOnce();
    reply(true);
    await settled();
    expect(control.destroyed).toBe(true);
  });

  it('keeps the window open after a refused flush until 강제로 닫기', async () => {
    const {control, log, reply} = setup();
    electron.ipcMain.emit(Channels.appCloseAnyway, CONTROL_ID);
    control.close();
    reply(false);
    await settled();
    expect(control.destroyed).toBe(false);
    electron.ipcMain.emit(Channels.appCloseAnyway, OTHER_ID);
    expect(control.destroyed).toBe(false);
    electron.ipcMain.emit(Channels.appCloseAnyway, CONTROL_ID);
    expect(control.destroyed).toBe(true);
    expect(log.messages('warn')).toEqual([
      `ignored ${Channels.appCloseAnyway} from another window`,
    ]);
  });

  it('closes at once on 강제로 닫기 while the flush still runs', async () => {
    const {control, log, closing} = setup();
    control.close();
    const quit = closing.confirmClose();
    electron.ipcMain.emit(Channels.appCloseAnyway, CONTROL_ID);
    await expect(quit).resolves.toBe(true);
    await settled();
    expect(control.destroyed).toBe(true);
    expect(log.messages('info')).toEqual([
      'closing the control window before its flush ends',
    ]);
  });

  it('asks again on the next close after a refusal', async () => {
    const {control, reply} = setup();
    control.close();
    reply(false);
    await settled();
    control.close();
    expect(control.webContents.send).toHaveBeenCalledTimes(2);
    expect(control.destroyed).toBe(false);
    reply(true, CONTROL_ID, 1);
    await settled();
    expect(control.destroyed).toBe(true);
  });

  it('closes after the flush bound when no reply comes', async () => {
    const clock = installFakeClock();
    const {control, log} = setup();
    control.close();
    await clock.advance(APP_FLUSH_LIMITS.timeoutMs - 1);
    expect(control.destroyed).toBe(false);
    await clock.advance(1);
    expect(control.destroyed).toBe(true);
    expect(log.messages('warn')).toEqual([
      'the control window did not answer the flush request in time',
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts only replies from the control window for the pending request', async () => {
    const {control, log, closing, requestId, reply} = setup();
    const confirmed = closing.confirmClose();
    reply(true, OTHER_ID);
    electron.ipcMain.emit(Channels.appFlushDone, CONTROL_ID, {
      requestId: '00000000-0000-4000-8000-000000000001',
      result: true,
    });
    electron.ipcMain.emit(Channels.appFlushDone, CONTROL_ID, {
      requestId: requestId(),
      result: 'yes',
    });
    await settled();
    expect(log.messages('warn')).toEqual([
      `ignored ${Channels.appFlushDone} from another window`,
      'ignored a malformed flush reply',
      'ignored a malformed flush reply',
    ]);
    reply(false);
    await expect(confirmed).resolves.toBe(false);
    expect(control.destroyed).toBe(false);
  });

  it('joins repeated close and quit requests on one flush request', async () => {
    const {control, closing, reply} = setup();
    control.close();
    const quit = closing.confirmClose();
    control.close();
    expect(control.webContents.send).toHaveBeenCalledOnce();
    reply(true);
    await expect(quit).resolves.toBe(true);
    await settled();
    expect(control.destroyed).toBe(true);
    await expect(closing.confirmClose()).resolves.toBe(true);
    expect(control.webContents.send).toHaveBeenCalledOnce();
  });

  it('closes at once when the renderer is gone or the request cannot be sent', async () => {
    const {control, closing} = setup();
    control.close();
    control.webContents.emit('render-process-gone');
    await settled();
    expect(control.destroyed).toBe(true);
    const other = setup();
    other.control.webContents.send.mockImplementation(() => {
      throw new Error('Invented send failure');
    });
    await expect(other.closing.confirmClose()).resolves.toBe(true);
    expect(other.log.messages('warn')).toEqual([
      'could not ask the control window to flush',
    ]);
    await expect(closing.confirmClose()).resolves.toBe(true);
  });

  it('settles a pending request and removes every listener on dispose', async () => {
    const {control, closing} = setup();
    const confirmed = closing.confirmClose();
    closing.dispose();
    await expect(confirmed).resolves.toBe(true);
    expect(electron.ipcMain.count()).toBe(0);
    expect(control.listenerCount('close')).toBe(0);
    expect(control.webContents.listenerCount('render-process-gone')).toBe(0);
    control.close();
    expect(control.destroyed).toBe(true);
  });

  it('disposes after destruction without reading the destroyed window contents', () => {
    const {control, closing} = setup();
    const contents = control.webContents;
    control.destroyed = true;
    contents.destroyed = true;
    Object.defineProperty(control, 'webContents', {
      get: () => {
        throw new TypeError('Object has been destroyed');
      },
    });
    expect(() => closing.dispose()).not.toThrow();
    expect(electron.ipcMain.count()).toBe(0);
    expect(() => closing.dispose()).not.toThrow();
  });
});
