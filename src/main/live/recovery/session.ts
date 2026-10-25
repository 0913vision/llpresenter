import {randomUUID} from 'node:crypto';
import {lstat, open, rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {Logger} from '../../log';
import {writeFileAtomically} from '../../store/atomicWrite';
import {isMissingFile} from '../../store/fsErrors';

export const SESSION_LOCK_FILE = 'session.lock';

export interface RecoverySession {
  readonly crashed: boolean;
  cleanExit(): Promise<void>;
}

interface SessionOptions {
  readonly folder: string;
  readonly log: Logger;
}

interface Marker {
  readonly file: string;
  readonly token: string | null;
  readonly crashed: boolean;
}

async function acquireMarker({folder, log}: SessionOptions): Promise<Marker> {
  const file = join(folder, SESSION_LOCK_FILE);
  let crashed = false;
  try {
    await lstat(file);
    crashed = true;
  } catch (error) {
    if (!isMissingFile(error)) {
      log.warn('could not inspect the recovery session marker', error);
      return {file, token: null, crashed: true};
    }
  }
  const token = randomUUID();
  const written = await writeFileAtomically(file, token);
  if (!written.ok) {
    log.warn('could not write the recovery session marker', written.error);
  }
  return {file, token: written.ok ? token : null, crashed};
}

async function ownsMarker(file: string, token: string): Promise<boolean> {
  const handle = await open(file, 'r');
  try {
    const bytes = Buffer.from(token, 'utf8');
    const buffer = Buffer.alloc(bytes.length + 1);
    const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
    return (
      bytesRead === bytes.length && buffer.subarray(0, bytesRead).equals(bytes)
    );
  } finally {
    await handle.close();
  }
}

async function removeMarker({file, token}: Marker, log: Logger): Promise<void> {
  if (token === null) return;
  try {
    if (!(await ownsMarker(file, token))) {
      log.warn('recovery session marker changed; keeping it');
      return;
    }
    await rm(file, {force: true});
  } catch (error) {
    if (!isMissingFile(error)) {
      log.warn('could not remove the recovery session marker', error);
    }
  }
}

/** Opens after Electron's single-instance lock; only a completed shutdown removes the marker. */
export async function openRecoverySession(
  options: SessionOptions,
): Promise<RecoverySession> {
  const marker = await acquireMarker(options);
  let finishing: Promise<void> | null = null;
  return {
    crashed: marker.crashed,
    cleanExit: () => (finishing ??= removeMarker(marker, options.log)),
  };
}
