import {readFile} from 'node:fs/promises';
import {writeFileAtomically} from '../store/atomicWrite';
import type {UiStateIo} from './uiStateStore';

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/**
 * The real files: a missing file reads as null, and a write is atomic and a
 * failed one rejects with the reason.
 */
export const fileIo: UiStateIo = {
  read: async file => {
    try {
      return await readFile(file, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  },
  write: async (file, text) => {
    const written = await writeFileAtomically(file, text);
    if (!written.ok) throw new Error(written.error.message);
  },
};
