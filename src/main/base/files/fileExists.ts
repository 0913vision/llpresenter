import {stat} from 'node:fs/promises';

/** Whether a path is a file that can be read. Never throws. */
export async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
