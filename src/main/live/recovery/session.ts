import {randomUUID} from 'node:crypto';
import {lstat, open, rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {Logger} from '../../log';
import {writeFileAtomically} from '../../store/atomicWrite';
import {isMissingFile} from '../../store/fsErrors';
import {removeStaleTempFiles} from '../../store/staleTempFiles';

export const SESSION_LOCK_FILE = 'session.lock';
export const RECOVERY_RECORD_FILE = 'live.json';

const QUITTING_SUFFIX = '\nquitting';
const MAX_MARKER_BYTES = 64;

/** What the previous launch was doing when it left its marker behind. */
type LeftMarker = 'running' | 'quitting' | 'unknown';

export interface RecoverySession {
  readonly crashed: boolean;
  /** Records that quitting started, so the next launch logs an unfinished quit apart from a crash. */
  markQuitting(): Promise<void>;
  cleanExit(): Promise<void>;
}

interface SessionOptions {
  readonly folder: string;
  readonly log: Logger;
}

interface Marker {
  readonly file: string;
  readonly token: string | null;
  readonly leftWhile: LeftMarker | null;
}

const LEFT_MARKER_MESSAGES: Record<LeftMarker, string> = {
  running: 'the previous session crashed while running',
  quitting: 'the previous session did not finish quitting',
  unknown: 'the previous session left an unrecognized marker',
};

async function readMarker(file: string): Promise<string | null> {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(MAX_MARKER_BYTES + 1);
    const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
    return bytesRead > MAX_MARKER_BYTES
      ? null
      : buffer.toString('utf8', 0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function leftMarker(file: string): Promise<LeftMarker | null> {
  try {
    if (!(await lstat(file)).isFile()) return 'unknown';
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  const text = await readMarker(file);
  if (text === null) return 'unknown';
  return text.endsWith(QUITTING_SUFFIX) ? 'quitting' : 'running';
}

async function removeTemporaryFiles({
  folder,
  log,
}: SessionOptions): Promise<void> {
  for (const problem of await removeStaleTempFiles(folder)) {
    log.warn('could not remove a temporary recovery file', problem);
  }
}

async function removeStaleRecord(folder: string, log: Logger): Promise<void> {
  try {
    await rm(join(folder, RECOVERY_RECORD_FILE), {force: true});
  } catch (error) {
    log.warn('could not remove the previous recovery record', error);
  }
}

async function acquireMarker({folder, log}: SessionOptions): Promise<Marker> {
  const file = join(folder, SESSION_LOCK_FILE);
  let leftWhile: LeftMarker | null;
  try {
    leftWhile = await leftMarker(file);
  } catch (error) {
    log.warn('could not inspect the recovery session marker', error);
    return {file, token: null, leftWhile: 'unknown'};
  }
  // NOTE(0913vision): A record without a marker belongs to a session that
  // exited cleanly. It goes before the new marker, so a crash right after
  // launch never offers it.
  if (leftWhile === null) await removeStaleRecord(folder, log);
  else log.warn(LEFT_MARKER_MESSAGES[leftWhile]);
  const token = randomUUID();
  const written = await writeFileAtomically(file, token);
  if (!written.ok) {
    log.warn('could not write the recovery session marker', written.error);
  }
  return {file, token: written.ok ? token : null, leftWhile};
}

async function ownsMarker(file: string, token: string): Promise<boolean> {
  const text = await readMarker(file);
  return text === token || text === token + QUITTING_SUFFIX;
}

async function markQuitting({file, token}: Marker, log: Logger): Promise<void> {
  if (token === null) return;
  try {
    if (!(await ownsMarker(file, token))) return;
    const written = await writeFileAtomically(file, token + QUITTING_SUFFIX);
    if (!written.ok) {
      log.warn(
        'could not mark the recovery session as quitting',
        written.error,
      );
    }
  } catch (error) {
    if (!isMissingFile(error)) {
      log.warn('could not mark the recovery session as quitting', error);
    }
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
  await removeTemporaryFiles(options);
  const marker = await acquireMarker(options);
  let quitting: Promise<void> | null = null;
  let finishing: Promise<void> | null = null;
  return {
    crashed: marker.leftWhile !== null,
    markQuitting: () =>
      (quitting ??=
        finishing === null
          ? markQuitting(marker, options.log)
          : Promise.resolve()),
    cleanExit: () =>
      (finishing ??= (quitting ?? Promise.resolve()).then(() =>
        removeMarker(marker, options.log),
      )),
  };
}
