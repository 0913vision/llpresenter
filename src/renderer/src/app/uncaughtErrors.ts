import type {LlpApi} from '@contracts/ipc/api';
import {rendererErrorEntry} from '@core/schema/app/ipcPayloads';

/**
 * Sends every uncaught error and unhandled rejection of this window to the app
 * log, named by `window`, so a failure on the church PC is in its log as the
 * output windows' are (docs/TECH.md, error handling).
 *
 * @returns A function that stops it.
 */
export function logUncaughtErrors(
  api: Pick<LlpApi, 'log'> | undefined,
  window: string,
): () => void {
  if (api === undefined) return () => undefined;
  const onError = (event: ErrorEvent): void => {
    api.log.write(
      rendererErrorEntry(
        `uncaught error in the ${window}`,
        event.error ?? event.message,
      ),
    );
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    api.log.write(
      rendererErrorEntry(`unhandled rejection in the ${window}`, event.reason),
    );
  };
  globalThis.addEventListener('error', onError);
  globalThis.addEventListener('unhandledrejection', onRejection);
  return () => {
    globalThis.removeEventListener('error', onError);
    globalThis.removeEventListener('unhandledrejection', onRejection);
  };
}
