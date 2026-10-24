import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../test/fake-clock';
import {makeTempDir} from '../../test/temp-dir';
import {createLogger, type Logger} from './log';
import {
  QUIT_FLUSH_LIMIT_MS,
  flushLogBeforeQuit,
  type QuittingApp,
} from './quit';

// NOTE(0913vision): The fake quits like Electron: a quit made while a
// will-quit is being handled is ignored, and after a prevented will-quit only a
// quit from a later task gets through (qa bug M1-11).
class FakeApp implements QuittingApp {
  quitted = false;
  private quitting = false;
  private readonly listeners: Array<(event: {preventDefault(): void}) => void> =
    [];

  on(
    _event: 'will-quit',
    listener: (event: {preventDefault(): void}) => void,
  ): void {
    this.listeners.push(listener);
  }

  quit(): void {
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

describe('flushLogBeforeQuit', () => {
  it('writes every queued line before the app quits', async () => {
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    const dir = await makeTempDir();
    const log = createLogger(dir);
    const app = new FakeApp();
    flushLogBeforeQuit(app, log);
    for (let i = 0; i < 50; i += 1) log.warn('dropped a malformed command', i);
    app.quit();
    expect(app.quitted).toBe(false);
    await vi.waitFor(() => expect(app.quitted).toBe(true));
    const text = await readFile(join(dir, 'main.log'), 'utf8');
    expect(text.trimEnd().split(/\r?\n/)).toHaveLength(50);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('quits when nothing is waiting in the log', async () => {
    const dir = await makeTempDir();
    const log = createLogger(dir);
    const app = new FakeApp();
    flushLogBeforeQuit(app, log);
    app.quit();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
  });

  it('quits even when quit is asked for again and again while it flushes', async () => {
    const dir = await makeTempDir();
    const log = createLogger(dir);
    const app = new FakeApp();
    flushLogBeforeQuit(app, log);
    log.info('last line');
    app.quit();
    app.quit();
    await new Promise(resolve => setImmediate(resolve));
    app.quit();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
    const text = await readFile(join(dir, 'main.log'), 'utf8');
    expect(text).toContain('last line');
  });

  it('quits anyway once the limit passes on a stuck disk', async () => {
    const clock = installFakeClock();
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    const stuck: Logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      flush: () => new Promise<void>(() => undefined),
    };
    const app = new FakeApp();
    flushLogBeforeQuit(app, stuck);
    app.quit();
    await clock.advance(QUIT_FLUSH_LIMIT_MS - 1);
    expect(app.quitted).toBe(false);
    await clock.advance(1);
    await clock.runAll();
    expect(app.quitted).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('quits when the flush fails and leaves no timer', async () => {
    installFakeClock();
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    const failing: Logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      flush: () => Promise.reject(new Error('disk gone')),
    };
    const app = new FakeApp();
    flushLogBeforeQuit(app, failing);
    app.quit();
    await vi.waitFor(() => expect(app.quitted).toBe(true));
    expect(vi.getTimerCount()).toBe(0);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('keeps the first deadline when quit is asked again during the flush', async () => {
    const clock = installFakeClock();
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    const stuck: Logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      flush: () => new Promise<void>(() => undefined),
    };
    const app = new FakeApp();
    flushLogBeforeQuit(app, stuck);
    app.quit();
    await clock.advance(QUIT_FLUSH_LIMIT_MS - 500);
    app.quit();
    expect(app.quitted).toBe(false);
    await clock.advance(500);
    await clock.runAll();
    expect(app.quitted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
