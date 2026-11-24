import {useLive} from '../live';

let outputRequest = 0;

/** Invalidates earlier delayed output across service and library sources. */
export function beginOutputRequest(): number {
  return ++outputRequest;
}

/**
 * Whether an output request is still the newest and nothing changed the live
 * state since.
 */
export function isOutputRequestCurrent(
  request: number,
  commandVersion: number,
): boolean {
  return (
    request === outputRequest &&
    commandVersion === useLive.getState().commandVersion
  );
}
