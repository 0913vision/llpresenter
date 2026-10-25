import {rm} from 'node:fs/promises';
import type {Logger} from '../log';
import type {DocumentFiles} from './contentPersistence';
import type {RecoveryCopies} from './recoveryCopies';
import type {Saver} from './saver';

export interface DocumentFilesOptions {
  readonly saver: Saver;
  readonly copies: Pick<RecoveryCopies, 'keepBeforeDelete'>;
  readonly log: Logger;
}

/**
 * Saves documents through the saver, which keeps a recovery copy and writes
 * atomically, and deletes them after keeping a last recovery copy, so a
 * deleted song can still be found in `.복구 사본`. Never throws.
 */
export function documentFiles({
  saver,
  copies,
  log,
}: DocumentFilesOptions): DocumentFiles {
  return {
    write: request => saver.save(request),
    remove: async target => {
      await saver.idle();
      const copied = await copies.keepBeforeDelete(target);
      if (!copied.ok) {
        log.warn('could not keep a recovery copy', copied.error);
      }
      try {
        await rm(target.file, {force: true});
        return {ok: true, value: undefined};
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {ok: false, error: {file: target.file, message}};
      }
    },
  };
}
