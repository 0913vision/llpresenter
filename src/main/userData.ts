import {isAbsolute} from 'node:path';

/** Why `LLP_USER_DATA` can't be the app data folder. */
export interface UserDataProblem {
  readonly value: string;
  readonly reason: string;
}

/**
 * Moves the app data folder to the `LLP_USER_DATA` value when it is set.
 * Several sessions run the app at once during development, and each needs its
 * own folder and, with it, its own single-instance lock.
 *
 * @param value - The `LLP_USER_DATA` value, if any.
 * @param setPath - Moves the folder, as `app.setPath('userData', ...)` does.
 * @returns What is wrong with the value, or null when the folder is usable
 * (moved, or the default because the value is unset).
 */
export function applyUserDataOverride(
  value: string | undefined,
  setPath: (path: string) => void,
): UserDataProblem | null {
  if (value === undefined || value.length === 0) return null;
  if (!isAbsolute(value)) return {value, reason: 'the path is not absolute'};
  try {
    setPath(value);
    return null;
  } catch (error) {
    return {
      value,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
