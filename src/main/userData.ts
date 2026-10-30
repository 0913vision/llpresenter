import {isAbsolute, join} from 'node:path';

/** The app data folder's name in `%APPDATA%`: ASCII, with no spaces. */
export const APP_DATA_FOLDER_NAME = 'LoveLightPresenter';

/**
 * The default app data folder, in place of Electron's, which takes the product
 * name "LoveLight Presenter" with its space.
 *
 * @param appData - The `%APPDATA%` folder, as `app.getPath('appData')` gives it.
 */
export function defaultUserDataPath(appData: string): string {
  return join(appData, APP_DATA_FOLDER_NAME);
}

/** Why `LLP_USER_DATA` can't be the app data folder. */
export interface UserDataProblem {
  readonly value: string;
  readonly reason: string;
}

/**
 * Puts the app data folder at the `LLP_USER_DATA` value when it is set, and at
 * the default folder otherwise. Several sessions run the app at once during
 * development, and each needs its own folder and, with it, its own
 * single-instance lock.
 *
 * @param value - The `LLP_USER_DATA` value, if any.
 * @param setPath - Moves the folder, as `app.setPath('userData', ...)` does.
 * @param defaultPath - The folder to use when the value is unset.
 * @returns What is wrong with the folder, or null when it is usable.
 */
export function applyUserDataOverride(
  value: string | undefined,
  setPath: (path: string) => void,
  defaultPath: string,
): UserDataProblem | null {
  const unset = value === undefined || value.length === 0;
  const folder = unset ? defaultPath : value;
  if (!isAbsolute(folder)) {
    return {value: folder, reason: 'the path is not absolute'};
  }
  try {
    setPath(folder);
    return null;
  } catch (error) {
    return {
      value: folder,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
