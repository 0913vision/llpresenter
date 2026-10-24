import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {onTestFinished} from 'vitest';

const TEMP_DIR_PREFIX = 'llp-test-';

// NOTE(0913vision): Windows can hold a file open for a moment after a stream
// closes, so removal retries instead of failing the test.
const REMOVE_RETRIES = 5;

/**
 * Creates an empty folder under the system temp folder and deletes it with
 * everything in it when the current test finishes. Call it inside a test or a
 * `beforeEach` hook. Tests never touch real user folders.
 *
 * @returns the folder's absolute path
 */
export async function makeTempDir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX));
  onTestFinished(async () => {
    await rm(path, {recursive: true, force: true, maxRetries: REMOVE_RETRIES});
  });
  return path;
}
