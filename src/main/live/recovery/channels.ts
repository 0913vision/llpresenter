import {recoveryEndpoints} from '@contracts/ipc/recovery';
import type {RecoveryResult} from '@core/schema/recovery';
import {IpcHost} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import type {RecoveryPort} from './controller';

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
  const ipc = new IpcHost(log);
  ipc.query(recoveryEndpoints.summary, () =>
    recovery.summary().catch((error: unknown) => {
      log.error('could not summarize the recovery record', error);
      return null;
    }),
  );
  ipc.request(recoveryEndpoints.apply, request =>
    recovery.apply(request).catch((error: unknown) => {
      log.error('could not restore the output state', error);
      return FAILED;
    }),
  );
  ipc.query(recoveryEndpoints.startFresh, () =>
    recovery.startFresh().catch((error: unknown) => {
      log.error('could not start fresh after the crash', error);
      return FAILED;
    }),
  );
  return () => ipc.close();
}
