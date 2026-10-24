import {open, readFile, rename, rm} from 'node:fs/promises';
import {isJsonObject, type JsonObject} from '../json.mts';

/**
 * Writes a file so that a crash never leaves it half written: the text goes
 * to a temporary file, is flushed to disk, and then replaces the original.
 */
export async function writeFileAtomic(
  path: string,
  text: string,
): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    const handle = await open(temporary, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, {force: true});
    throw error;
  }
}

/**
 * Reads a JSON file that must hold an object.
 *
 * @throws Error when the file holds something else
 */
export async function readJsonObject(path: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isJsonObject(value)) throw new Error(`${path} does not hold an object`);
  return value;
}

/** Writes an object as npm does: two-space indent and a final newline. */
export async function writeJsonObject(
  path: string,
  value: JsonObject,
): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}
