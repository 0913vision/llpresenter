import {
  parseRecoveryApply,
  parseRecoveryResult,
  parseRecoverySummary,
  type RecoveryApply,
  type RecoveryResult,
  type RecoverySummary,
} from '@core/schema/recovery';
import {query, request, type IpcPort} from './endpoint';

/** The calls that restore the live output after a crash. */
export const recoveryEndpoints = {
  summary: query<RecoverySummary>('recovery:summary', parseRecoverySummary),
  apply: request<RecoveryApply, RecoveryResult>('recovery:apply', {
    request: parseRecoveryApply,
    reply: parseRecoveryResult,
  }),
  startFresh: query<RecoveryResult>(
    'recovery:start-fresh',
    parseRecoveryResult,
  ),
};

/** The crash recovery part of `window.llp`. */
export function recoveryApi(port: IpcPort) {
  return {
    /** Reads eligible restore rows. Null means there is no dialog to show. */
    summary: port.query(recoveryEndpoints.summary),
    /** Restores the checked rows of the offered record without start macros. */
    apply: port.request(recoveryEndpoints.apply),
    /** Discards crash state and follows normal launch preferences and macros. */
    startFresh: port.query(recoveryEndpoints.startFresh),
  };
}

export type RecoveryApi = ReturnType<typeof recoveryApi>;
