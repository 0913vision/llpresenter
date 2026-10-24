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

class FakeApp implements QuittingApp {
  quitted = false;
  private readonly listeners: Array<(event: {preventDefault(): void}) => void> =
    [];

  on(
    _event: 'will-quit',
    listener: (event: {preventDefault(): void}) => void,
  ): void {
    this.listeners.push(listener);
  }

  quit(): void {
    const event = new QuitEvent();
    for (const listener of this.listeners) listener(event);
    if (!event.prevented) this.quitted = true;
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
    expect(app.quitted).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
