import {readFile} from 'node:fs/promises';
import {writeFileAtomic} from './atomicWrite';
import type {UiStateIo} from './uiStateStore';

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** The real files: a missing file reads as null, and writes are atomic. */
export const fileIo: UiStateIo = {
  read: async file => {
    try {
      return await readFile(file, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  },
  write: writeFileAtomic,
};
