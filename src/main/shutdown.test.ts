import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../test/fake-clock';
import {makeTempDir} from '../../test/temp-dir';
import {recordingLogger} from './displays/testing';
import {createLogger, type Logger} from './log';
import {
  LOG_FLUSH_LIMIT_MS,
  SAVE_LIMIT_MS,
  ShutdownCoordinator,
  type ShutdownApp,
} from './shutdown';

// NOTE(0913vision): The fake quits like Electron (qa bug M1-11): a quit made
// while a quit event is being handled is ignored, and after a prevented one
// only a quit from a later task gets through.
class FakeApp implements ShutdownApp {
  quitted = false;
  quitRequests = 0;
  lockReleased = false;
  private quitting = false;
  private readonly listeners: Array<(event: {preventDefault(): void}) => void> =
    [];

  on(
    _event: 'before-quit',
    listener: (event: {preventDefault(): void}) => void,
  ): void {
    this.listeners.push(listener);
  }

  releaseSingleInstanceLock(): void {
    this.lockReleased = true;
  }

  quit(): void {
    this.quitRequests += 1;
    if (this.quitting) return;
    this.quitting = true;
    const event = new QuitEvent();
    for (const listener of this.listeners) listener(event);
    if (!event.prevented) {
      this.quitted = true;
      return;
    }
    setImmediate(() => {
      this.quitting = false;
    });
  }
}

class QuitEvent {
  prevented = false;

  preventDefault(): void {
    this.prevented = true;
  }
}

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

const never = (): Promise<void> => new Promise<void>(() => undefined);

describe('ShutdownCoordinator', () => {
  it('quits with nothing to save and nothing in the log', async () => {
    const app = new FakeApp();
    new ShutdownCoordinator({app, log: createLogger(await makeTempDir())});
    app.quit();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
  });

  it('releases the single-instance lock only when the shutdown is done', async () => {
    const app = new FakeApp();
    const shutdown = new ShutdownCoordinator({
      app,
      log: createLogger(await makeTempDir()),
    });
    const save = deferred();
    shutdown.add({name: 'save the UI state', run: () => save.promise});
    app.quit();
    await new Promise(resolve => setImmediate(resolve));
    expect(app.lockReleased).toBe(false);
    save.resolve();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
    expect(app.lockReleased).toBe(true);
  });

  it('runs the steps in order, then flushes the log, then quits', async () => {
    const dir = await makeTempDir();
    const log = createLogger(dir);
    const app = new FakeApp();
    const shutdown = new ShutdownCoordinator({app, log});
    const order: string[] = [];
    const soak = deferred();
    shutdown.add({
      name: 'stop the outputs',
      run: () => void order.push('outputs'),
    });
    shutdown.add({
      name: 'finish the soak record',
      run: async () => {
        order.push('soak');
        await soak.promise;
        log.info('soak record closed');
      },
    });
    shutdown.add({name: 'save the UI state', run: () => void order.push('ui')});
    app.quit();
    await vi.waitFor(() => expect(order).toEqual(['outputs', 'soak']));
    expect(app.quitted).toBe(false);
    soak.resolve();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
    expect(order).toEqual(['outputs', 'soak', 'ui']);
    const text = await readFile(join(dir, 'main.log'), 'utf8');
    expect(text).toContain('soak record closed');
  });

  it('holds every quit request on the same shutdown', async () => {
    const app = new FakeApp();
    const shutdown = new ShutdownCoordinator({
      app,
      log: createLogger(await makeTempDir()),
    });
    const save = deferred();
    const run = vi.fn(() => save.promise);
    shutdown.add({name: 'save the UI state', run});
    app.quit();
    await new Promise(resolve => setImmediate(resolve));
    app.quit();
    app.quit();
    expect(app.quitted).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    save.resolve();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
  });

  it('logs a failing step and carries on with the next', async () => {
    const log = recordingLogger();
    const app = new FakeApp();
    const shutdown = new ShutdownCoordinator({app, log});
    const after = vi.fn();
    shutdown.add({
      name: 'save the UI state',
      run: () => {
        throw new Error('disk full');
      },
    });
    shutdown.add({name: 'finish the soak record', run: after});
    app.quit();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
    expect(after).toHaveBeenCalled();
    expect(log.messages('error')).toEqual([
      'could not save the UI state before quitting',
    ]);
  });

  it('quits after the save limit when a step never ends', async () => {
    const clock = installFakeClock();
    const log = recordingLogger();
    const app = new FakeApp();
    const shutdown = new ShutdownCoordinator({app, log});
    shutdown.add({name: 'finish the soak record', run: never});
    app.quit();
    await clock.advance(SAVE_LIMIT_MS - 1);
    expect(app.quitted).toBe(false);
    await clock.advance(1);
    await clock.runAll();
    expect(app.quitted).toBe(true);
    expect(log.entries.at(-1)).toMatchObject({
      level: 'error',
      message: 'saving before quitting took too long; quitting anyway',
      detail: {waitingFor: 'finish the soak record'},
    });
  });

  it('quits after the log flush limit when the disk is stuck', async () => {
    const clock = installFakeClock();
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    const stuck: Logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      flush: never,
    };
    const app = new FakeApp();
    new ShutdownCoordinator({app, log: stuck});
    app.quit();
    await clock.advance(LOG_FLUSH_LIMIT_MS - 1);
    expect(app.quitted).toBe(false);
    await clock.advance(1);
    await clock.runAll();
    expect(app.quitted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
