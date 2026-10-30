import {rm} from 'node:fs/promises';
import type {Logger} from '../log';
import type {DocumentFiles} from './contentPersistence';
import type {RecoveryCopies} from './recoveryCopies';
import type {SaveFailureSink} from './saveFailures';
import type {Saver} from './saver';

export interface DocumentFilesOptions {
  readonly saver: Saver;
  readonly copies: Pick<RecoveryCopies, 'keepBeforeDelete'>;
  readonly log: Logger;
  /** Hears the files that couldn't be written, for 저장할 수 없음. */
  readonly failures?: SaveFailureSink | undefined;
}

/**
 * Saves documents through the saver, which keeps a recovery copy and writes
 * atomically, and deletes them after keeping a last recovery copy, so a
 * deleted song can still be found in `.recovery`. A failed copy keeps the
 * original and returns a failure for retry. Never throws.
 */
export function documentFiles({
  saver,
  copies,
  log,
  failures,
}: DocumentFilesOptions): DocumentFiles {
  return {
    failures,
    write: request => saver.save(request),
    remove: async target => {
      await saver.idle();
      const copied = await copies.keepBeforeDelete(target);
      if (!copied.ok) {
        log.warn('could not keep a recovery copy', copied.error);
        return copied;
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
