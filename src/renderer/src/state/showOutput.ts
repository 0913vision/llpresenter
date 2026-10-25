import {useLive} from './live';

const BACKGROUND_LOOKUP_TIMEOUT_MS = 2000;
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
          () => reject(new Error('Song background lookup timed out')),
          BACKGROUND_LOOKUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
