import {ipcMain} from 'electron';
import {recoveryEndpoints} from '@contracts/ipc/recovery';
import {parseRecoveryApply, type RecoveryResult} from '@core/schema/recovery';
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
  ipcMain.handle(recoveryEndpoints.summary.channel, () =>
    recovery.summary().catch((error: unknown) => {
      log.error('could not summarize the recovery record', error);
      return null;
    }),
  );
  ipcMain.handle(recoveryEndpoints.apply.channel, (_event, value: unknown) => {
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
  ipcMain.handle(recoveryEndpoints.startFresh.channel, () =>
    recovery.startFresh().catch((error: unknown) => {
      log.error('could not start fresh after the crash', error);
      return FAILED;
    }),
  );
  return () => {
    ipcMain.removeHandler(recoveryEndpoints.summary.channel);
    ipcMain.removeHandler(recoveryEndpoints.apply.channel);
    ipcMain.removeHandler(recoveryEndpoints.startFresh.channel);
  };
}
