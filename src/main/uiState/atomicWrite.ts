import {mkdir, open, rename, rm} from 'node:fs/promises';
import {dirname} from 'node:path';

const TEMP_SUFFIX = '.tmp';

/**
 * Writes a file so that a crash never leaves it half written: the text goes to
 * a temporary file next to it, is flushed to disk, and then replaces the file
 * with a rename.
 */
export async function writeFileAtomic(
  file: string,
  text: string,
): Promise<void> {
  await mkdir(dirname(file), {recursive: true});
  const temporary = `${file}${TEMP_SUFFIX}`;
  try {
    const handle = await open(temporary, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, {force: true});
    throw error;
  }
}
