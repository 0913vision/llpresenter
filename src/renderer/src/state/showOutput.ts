import {useLive} from '../platform/live';

/** How long a fresh song read may take before it counts as failed. */
export const LOOKUP_TIMEOUT_MS = 2000;
let outputRequest = 0;

/** Invalidates earlier delayed output across service and library sources. */
export function beginOutputRequest(): number {
  return ++outputRequest;
}

export function isOutputRequestCurrent(
  request: number,
  commandVersion: number,
): boolean {
  return (
    request === outputRequest &&
    commandVersion === useLive.getState().commandVersion
  );
}

/** Bounds a fresh background lookup and always releases its timer. */
export async function withinLookupTimeout<T>(
  read: () => Promise<T>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Song lookup timed out')),
          LOOKUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
