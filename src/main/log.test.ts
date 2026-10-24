import {mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createLogger} from './log';

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
});
