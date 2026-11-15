import {app} from 'electron';
import {stat} from 'node:fs/promises';
import {dirname, isAbsolute} from 'node:path';
import type {UiStateFields} from '../store/appConfigFile';

type PickerFolder =
  | 'mediaImportFolder'
  | 'mediaRelinkFolder'
  | 'textImportFolder'
  | 'powerpointImportFolder';

/** Returns the picker's saved existing folder, or the Documents folder. */
export async function pickerFolder(
  state: UiStateFields | undefined,
  field: PickerFolder,
): Promise<string> {
  const folder = state?.read()[field];
  if (folder !== undefined && isAbsolute(folder)) {
    try {
      if ((await stat(folder)).isDirectory()) return folder;
    } catch {
      // NOTE(0913vision): A removed or inaccessible folder falls back to Documents.
    }
  }
  return app.getPath('documents');
}

/** Saves the first selected file's directory for this picker. */
export function rememberPickerFile(
  state: UiStateFields | undefined,
  field: PickerFolder,
  file: string | undefined,
): void {
  if (file !== undefined && isAbsolute(file)) {
    state?.change({[field]: dirname(file)});
  }
}
