import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {writeFileAtomically} from '../../src/main/store/atomicWrite';
import {encodeChunkedBible} from './encode';

function comparablePath(file: string): string {
  const absolute = resolve(file);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

async function existingFile(file: string) {
  try {
    return await stat(file);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function requireDifferentFiles(
  source: string,
  destination: string,
): Promise<void> {
  if (comparablePath(source) === comparablePath(destination)) {
    throw new Error('Source and destination must be different files');
  }
  const [input, output] = await Promise.all([
    stat(source),
    existingFile(destination),
  ]);
  if (!input.isFile()) throw new Error('Expected a regular source file');
  if (output?.dev === input.dev && output.ino === input.ino) {
    throw new Error('Source and destination refer to the same file');
  }
}

/** Validates before an atomic write; failures leave the source and destination intact. */
export async function convertBibleFile(
  source: string,
  destination: string,
): Promise<void> {
  await requireDifferentFiles(source, destination);
  const encoded = encodeChunkedBible(await readFile(source), source);
  const written = await writeFileAtomically(destination, encoded);
  if (!written.ok) throw new Error(written.error.message);
}
