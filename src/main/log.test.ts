import {
  appendFile,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import type * as FsPromises from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../test/fake-clock';
import {createLogger, flushWithin, type Logger} from './log';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof FsPromises>();
  return {...actual, appendFile: vi.fn(actual.appendFile)};
});

const BURST_LINES = 10_000;
const SMALL_CAP = 100;
const BATCHED_WRITES_AT_MOST = 3;
const RESPONSIVE_MS = 250;

async function linesOf(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8');
  return text.trimEnd().split(/\r?\n/);
}

describe('createLogger', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'llp-log-'));
  });

  afterEach(async () => {
    await rm(dir, {recursive: true, force: true});
  });

  it('writes the time, level, and message, and appends error stacks', async () => {
    const log = createLogger(join(dir, 'logs'));
    log.info('started', {version: '0.2.0'});
    log.error('failed', new Error('display not found'));
    await log.flush();
    const text = await readFile(join(dir, 'logs', 'main.log'), 'utf8');
    const [first] = text.trim().split('\n');
    expect(first).toMatch(
      /^\d{4}-\d{2}-\d{2}T.* INFO started \{"version":"0.2.0"\}$/,
    );
    expect(text).toContain('ERROR failed Error: display not found');
  });

  it('rotates at the size limit and keeps only the configured number of files', async () => {
    const maxBytes = 200;
    const log = createLogger(dir, {maxBytes, keep: 2});
    for (let i = 0; i < 40; i += 1) {
      log.info(`line ${i}`, {padding: 'x'.repeat(40)});
    }
    await log.flush();
    const files = (await readdir(dir)).sort();
    expect(files).toEqual(['main.1.log', 'main.2.log', 'main.log']);
    const current = await readFile(join(dir, 'main.log'), 'utf8');
    expect(Buffer.byteLength(current)).toBeLessThanOrEqual(maxBytes);
    expect(current).toContain('line 39');
  });

  it('keeps logging when a detail cannot be serialized', async () => {
    const log = createLogger(dir);
    const cyclic: {self?: unknown} = {};
    cyclic.self = cyclic;
    log.warn('odd value', cyclic);
    log.info('next line');
    await log.flush();
    const text = await readFile(join(dir, 'main.log'), 'utf8');
    expect(text).toContain(
      'WARN odd value [detail that JSON cannot represent]',
    );
    expect(text).toContain('INFO next line');
  });

  it('writes a bigint detail with its n suffix', async () => {
    const log = createLogger(dir);
    log.info('big', 12345678901234567890n);
    await log.flush();
    const text = await readFile(join(dir, 'main.log'), 'utf8');
    expect(text).toContain('INFO big 12345678901234567890n');
  });

  it('merges a line repeated in a row into one line with a count', async () => {
    const log = createLogger(dir);
    for (let i = 0; i < 5; i += 1) log.warn('dropped a malformed command', 7);
    log.warn('dropped a malformed command', 8);
    await log.flush();
    const lines = await linesOf(join(dir, 'main.log'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(
      /WARN dropped a malformed command 7 \(repeated 5 times\)$/,
    );
    expect(lines[1]).toMatch(/WARN dropped a malformed command 8$/);
  });

  it('keeps a burst under the cap and writes how many lines it dropped', async () => {
    const log = createLogger(dir, {maxPendingLines: SMALL_CAP});
    let mostPending = 0;
    for (let i = 0; i < BURST_LINES; i += 1) {
      log.warn('dropped a malformed command', i);
      mostPending = Math.max(mostPending, log.pendingLines);
    }
    expect(mostPending).toBeLessThanOrEqual(SMALL_CAP);
    await log.flush();
    const lines = await linesOf(join(dir, 'main.log'));
    const droppedLine = lines.at(-1) ?? '';
    const dropped = Number(/(\d+) log lines dropped/.exec(droppedLine)?.[1]);
    expect(lines.length - 1 + dropped).toBe(BURST_LINES);
    expect(lines.length - 1).toBeLessThanOrEqual(SMALL_CAP + 1);
  });

  it('writes a burst in a few batches and stays responsive meanwhile', async () => {
    const log = createLogger(dir);
    vi.mocked(appendFile).mockClear();
    for (let i = 0; i < BURST_LINES; i += 1) log.info('line', i);
    const started = performance.now();
    await new Promise(resolve => setImmediate(resolve));
    expect(performance.now() - started).toBeLessThan(RESPONSIVE_MS);
    await log.flush();
    expect(vi.mocked(appendFile).mock.calls.length).toBeLessThanOrEqual(
      BATCHED_WRITES_AT_MOST,
    );
    expect(log.pendingLines).toBe(0);
  });

  it('writes a line logged while a write is under way, before the first flush settles', async () => {
    const log = createLogger(dir);
    const realAppend = vi.mocked(appendFile).getMockImplementation();
    let release: () => void = () => undefined;
    const paused = new Promise<void>(resolve => {
      release = resolve;
    });
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>(resolve => {
      markStarted = resolve;
    });
    vi.mocked(appendFile).mockImplementationOnce(async (...args) => {
      markStarted();
      await paused;
      return realAppend?.(...args);
    });
    log.info('first');
    const flushing = log.flush();
    await started;
    log.info('second');
    release();
    await flushing;
    const lines = await linesOf(join(dir, 'main.log'));
    expect(lines.map(line => line.split(' ').at(-1))).toEqual([
      'first',
      'second',
    ]);
  });

  it('does not merge a repeat across a dropped line', async () => {
    const log = createLogger(dir, {maxPendingLines: 1});
    log.info('A');
    log.info('B');
    log.info('A');
    await log.flush();
    const lines = await linesOf(join(dir, 'main.log'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/INFO A$/);
    expect(lines[1]).toMatch(/WARN 2 log lines dropped/);
  });

  it('drops and reports a batch it cannot write, and still settles', async () => {
    const errors = vi.spyOn(console, 'error').mockReturnValue(undefined);
    const blocker = join(dir, 'blocker');
    await writeFile(blocker, 'not a folder');
    const log = createLogger(join(blocker, 'logs'));
    log.info('lost');
    await log.flush();
    log.info('lost too');
    await log.flush();
    expect(errors).toHaveBeenCalledTimes(2);
    expect(errors.mock.calls[0]?.[0]).toBe('could not write 1 log lines');
    expect(log.pendingLines).toBe(0);
  });
});

describe('flushWithin', () => {
  const stuck: Logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    flush: () => new Promise<void>(() => undefined),
  };

  it('reports a flush that finished in time', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'llp-log-'));
    const log = createLogger(dir);
    log.info('last words');
    expect(await flushWithin(log, 2000)).toBe(true);
    await rm(dir, {recursive: true, force: true});
  });

  it('gives up on a stuck disk after the limit and leaves no timer', async () => {
    const clock = installFakeClock();
    const result = flushWithin(stuck, 2000);
    await clock.advance(2000);
    expect(await result).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
