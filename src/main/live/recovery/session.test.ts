import {mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../../test/temp-dir';
import {recordingLogger} from '../../displays/testing';
import {openRecoverySession, SESSION_LOCK_FILE} from './session';

async function setup() {
  const folder = join(await makeTempDir(), 'recovery');
  const log = recordingLogger();
  return {folder, log, file: join(folder, SESSION_LOCK_FILE)};
}

describe('recovery session marker', () => {
  it('creates a durable marker on first launch and removes it on clean exit', async () => {
    const {folder, log, file} = await setup();
    const session = await openRecoverySession({folder, log});
    expect(session.crashed).toBe(false);
    expect(await readFile(file, 'utf8')).toMatch(/^[0-9a-f-]{36}$/);
    await Promise.all([session.cleanExit(), session.cleanExit()]);
    await expect(stat(file)).rejects.toMatchObject({code: 'ENOENT'});
    const restarted = await openRecoverySession({folder, log});
    expect(restarted.crashed).toBe(false);
    await restarted.cleanExit();
    expect(log.entries).toEqual([]);
  });

  it('detects a crash without consuming or changing its recovery record', async () => {
    const {folder, log, file} = await setup();
    await mkdir(folder);
    const record = join(folder, 'live.json');
    await writeFile(record, 'previous recovery record');
    await writeFile(file, 'unclean previous launch');
    const session = await openRecoverySession({folder, log});
    expect(session.crashed).toBe(true);
    expect(await readFile(record, 'utf8')).toBe('previous recovery record');
    await session.cleanExit();
    expect(await readFile(record, 'utf8')).toBe('previous recovery record');
  });

  it('does not remove a marker replaced by a newer launch', async () => {
    const {folder, log, file} = await setup();
    const old = await openRecoverySession({folder, log});
    const current = await openRecoverySession({folder, log});
    expect(current.crashed).toBe(true);
    const token = await readFile(file, 'utf8');
    await old.cleanExit();
    expect(await readFile(file, 'utf8')).toBe(token);
    expect(log.messages('warn')).toEqual([
      'recovery session marker changed; keeping it',
    ]);
    await current.cleanExit();
  });

  it('leaves an overlong replacement marker intact', async () => {
    const {folder, log, file} = await setup();
    const session = await openRecoverySession({folder, log});
    const token = await readFile(file, 'utf8');
    await writeFile(file, token + 'x'.repeat(512));
    await session.cleanExit();
    expect(await readFile(file, 'utf8')).toBe(token + 'x'.repeat(512));
  });

  it('does not block launch when the recovery folder is a file', async () => {
    const {folder, log} = await setup();
    await writeFile(folder, 'a file blocks the folder');
    const session = await openRecoverySession({folder, log});
    await expect(session.cleanExit()).resolves.toBeUndefined();
    expect(log.messages('warn')).toHaveLength(1);
  });

  it('logs a write failure and keeps the preexisting marker', async () => {
    const {folder, log, file} = await setup();
    await mkdir(file, {recursive: true});
    const session = await openRecoverySession({folder, log});
    expect(session.crashed).toBe(true);
    await session.cleanExit();
    expect((await stat(file)).isDirectory()).toBe(true);
    expect(log.messages('warn')).toEqual([
      'could not write the recovery session marker',
    ]);
  });

  it('logs a cleanup failure without deleting a replacement directory', async () => {
    const {folder, log, file} = await setup();
    const session = await openRecoverySession({folder, log});
    await rm(file);
    await mkdir(file);
    await expect(session.cleanExit()).resolves.toBeUndefined();
    expect((await stat(file)).isDirectory()).toBe(true);
    expect(log.messages('warn')).toEqual([
      'could not remove the recovery session marker',
    ]);
  });
});
