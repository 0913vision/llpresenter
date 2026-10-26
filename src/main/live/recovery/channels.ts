import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import {parseRecoveryApply, type RecoveryResult} from '@shared/schema/recovery';
import type {Logger} from '../../log';
import type {RecoveryPort} from './controller';

const MALFORMED: RecoveryResult = {
  ok: false,
  error: {reason: 'invalid-selection', message: 'The answer is malformed'},
};

const FAILED: RecoveryResult = {
  ok: false,
  error: {reason: 'apply-failed', message: 'The answer could not be handled'},
};

/**
 * Answers `recovery:summary`, `recovery:apply`, and `recovery:start-fresh`.
 * A malformed answer is logged and refused; a handler never rejects.
 *
 * @returns A function that removes the handlers.
 */
export function registerRecoveryChannels(
  recovery: RecoveryPort,
  log: Logger,
): () => void {
  ipcMain.handle(Channels.recoverySummary, () =>
    recovery.summary().catch((error: unknown) => {
      log.error('could not summarize the recovery record', error);
      return null;
    }),
  );
  ipcMain.handle(Channels.recoveryApply, (_event, value: unknown) => {
    const request = parseRecoveryApply(value);
    if (!request.ok) {
      log.warn('refused a malformed recovery answer', request.error);
      return MALFORMED;
    }
    return recovery.apply(request.value).catch((error: unknown) => {
      log.error('could not restore the output state', error);
      return FAILED;
    });
  });
  ipcMain.handle(Channels.recoveryStartFresh, () =>
    recovery.startFresh().catch((error: unknown) => {
      log.error('could not start fresh after the crash', error);
      return FAILED;
    }),
  );
  return () => {
    ipcMain.removeHandler(Channels.recoverySummary);
    ipcMain.removeHandler(Channels.recoveryApply);
    ipcMain.removeHandler(Channels.recoveryStartFresh);
  };
}
