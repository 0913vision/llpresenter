import {mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../../test/temp-dir';
import {recordingLogger} from '../../displays/testing';
import {
  openRecoverySession,
  RECOVERY_RECORD_FILE,
  SESSION_LOCK_FILE,
} from './session';

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
    expect(session.leftWhile).toBe('running');
    expect(await readFile(record, 'utf8')).toBe('previous recovery record');
    await session.cleanExit();
    expect(await readFile(record, 'utf8')).toBe('previous recovery record');
    expect(log.messages('warn')).toEqual([
      'the previous session crashed while running',
    ]);
  });

  it('removes the record of a cleanly closed session before writing the marker', async () => {
    const {folder, log, file} = await setup();
    await mkdir(folder);
    const record = join(folder, RECOVERY_RECORD_FILE);
    await writeFile(record, 'record of a clean session');
    const session = await openRecoverySession({folder, log});
    expect(session.crashed).toBe(false);
    expect(session.leftWhile).toBeNull();
    await expect(stat(record)).rejects.toMatchObject({code: 'ENOENT'});
    expect(await readFile(file, 'utf8')).toMatch(/^[0-9a-f-]{36}$/);
    await session.cleanExit();
    expect(log.entries).toEqual([]);
  });

  it('logs a stale record it cannot remove and still writes the marker', async () => {
    const {folder, log, file} = await setup();
    await mkdir(join(folder, RECOVERY_RECORD_FILE), {recursive: true});
    const session = await openRecoverySession({folder, log});
    expect(session.crashed).toBe(false);
    expect(await readFile(file, 'utf8')).toMatch(/^[0-9a-f-]{36}$/);
    expect(log.messages('warn')).toEqual([
      'could not remove the previous recovery record',
    ]);
    await session.cleanExit();
  });

  it('tells an unfinished quit apart from a crash at the next launch', async () => {
    const {folder, log, file} = await setup();
    const quit = await openRecoverySession({folder, log});
    const token = await readFile(file, 'utf8');
    await quit.markQuitting();
    expect(await readFile(file, 'utf8')).toBe(`${token}
quitting`);
    const next = await openRecoverySession({folder, log});
    expect(next.crashed).toBe(true);
    expect(next.leftWhile).toBe('quitting');
    expect(log.messages('warn')).toEqual([
      'the previous session did not finish quitting',
    ]);
    await next.markQuitting();
    await next.cleanExit();
    await expect(stat(file)).rejects.toMatchObject({code: 'ENOENT'});
    const clean = await openRecoverySession({folder, log});
    expect(clean.leftWhile).toBeNull();
    await clean.cleanExit();
  });

  it('never marks quitting after a clean exit or on a newer launch marker', async () => {
    const {folder, log, file} = await setup();
    const closing = await openRecoverySession({folder, log});
    await Promise.all([closing.cleanExit(), closing.markQuitting()]);
    await expect(stat(file)).rejects.toMatchObject({code: 'ENOENT'});
    await closing.markQuitting();
    await expect(stat(file)).rejects.toMatchObject({code: 'ENOENT'});
    const old = await openRecoverySession({folder, log});
    const current = await openRecoverySession({folder, log});
    const token = await readFile(file, 'utf8');
    await old.markQuitting();
    expect(await readFile(file, 'utf8')).toBe(token);
    await current.cleanExit();
    expect(log.messages('warn')).toEqual([
      'the previous session crashed while running',
    ]);
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
      'the previous session crashed while running',
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
    const next = await openRecoverySession({folder, log});
    expect(next.leftWhile).toBe('unknown');
    await next.cleanExit();
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
    expect(session.leftWhile).toBe('unknown');
    await session.cleanExit();
    expect((await stat(file)).isDirectory()).toBe(true);
    expect(log.messages('warn')).toEqual([
      'the previous session left an unrecognized marker',
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
