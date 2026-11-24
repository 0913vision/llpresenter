import type {LlpApi} from '@contracts/ipc/api';
import {rendererErrorEntry} from '@core/schema/app/ipcPayloads';

/**
 * Writes a failure to the app log as an error: `message` says what failed, the
 * detail is the cause's stack or what it says. Without the app API, as in a
 * browser preview, nothing is written.
 */
export function logFailure(
  api: Pick<LlpApi, 'log'> | undefined,
  message: string,
  cause: unknown,
): void {
  api?.log.write(rendererErrorEntry(message, cause));
}
