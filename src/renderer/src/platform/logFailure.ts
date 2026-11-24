import type {LlpApi} from '@contracts/ipc/api';

/** What a failure says: an error's message, or anything else as text. */
export function failureDetail(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Writes a failure to the app log as an error: `message` says what failed, the
 * detail what the cause says. Without the app API, as in a browser preview,
 * nothing is written.
 */
export function logFailure(
  api: Pick<LlpApi, 'log'> | undefined,
  message: string,
  cause: unknown,
): void {
  api?.log.write({level: 'error', message, detail: failureDetail(cause)});
}
