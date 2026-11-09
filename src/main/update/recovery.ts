import {lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {SESSION_LOCK_FILE} from '../live/recovery/session';
import {isMissingFile} from '../store/fsErrors';

/** A retained marker must never turn an update restart into crash recovery. */
export async function recoveryMarkerRemoved(folder: string): Promise<boolean> {
  try {
    await lstat(join(folder, SESSION_LOCK_FILE));
    return false;
  } catch (error) {
    if (isMissingFile(error)) return true;
    throw error;
  }
}
