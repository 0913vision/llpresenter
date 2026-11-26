import {rm} from 'node:fs/promises';
import type {Logger} from '../../base/log';
import type {DocumentFiles} from '../content/contentPersistence';
import type {RecoveryCopies} from './recoveryCopies';
import type {SaveFailureSink} from './saveFailures';
import type {DeletionHold} from './heldDeletions';
import type {Saver} from './saver';

/**
 * What the document files use: the saver, the recovery copies, the log, and
 * optionally the sink of failed writes.
 */
export interface DocumentFilesOptions {
  readonly saver: Saver;
  readonly copies: Pick<RecoveryCopies, 'keepBeforeDelete'>;
  readonly log: Logger;
  /** Hears the files that couldn't be written, for 저장할 수 없음. */
  readonly failures?: SaveFailureSink | undefined;
  /**
   * Holds the file of a deleted document until the app closes, when it goes
   * to the Windows 휴지통 (USER Nov 26); it is erased when this is absent.
   */
  readonly held?: DeletionHold | undefined;
}

/**
 * Saves documents through the saver, which keeps a recovery copy and writes
 * atomically, and deletes them after keeping a last recovery copy, so a
 * deleted song can still be found in `.recovery`, and in the 휴지통 once the
 * app closes. A document written again where it was deleted from, as 실행
 * 취소 does, takes its held file back first. A failed copy keeps the original
 * and returns a failure for retry. Never throws.
 */
export function documentFiles({
  saver,
  copies,
  log,
  failures,
  held,
}: DocumentFilesOptions): DocumentFiles {
  return {
    failures,
    // NOTE(0913vision): A save starts at once unless a held file comes back
    // first, so a delete asked for after it still waits for it.
    write: request =>
      held?.holds(request.target.file) === true
        ? held
            .restore(request.target.file)
            .catch((error: unknown) => {
              log.warn('could not take a deleted file back', error);
            })
            .then(() => saver.save(request))
        : saver.save(request),
    remove: async target => {
      await saver.idle();
      const copied = await copies.keepBeforeDelete(target);
      failures?.copyResult?.(target.file, copied.ok);
      if (!copied.ok) {
        log.warn('could not keep a recovery copy', copied.error);
        return copied;
      }
      try {
        if (held === undefined) await rm(target.file, {force: true});
        else await held.hold(target.file);
        return {ok: true, value: undefined};
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {ok: false, error: {file: target.file, message}};
      }
    },
  };
}
