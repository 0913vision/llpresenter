import * as v from 'valibot';
import type {Result} from '../result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  jsonRecord,
  nonBlankText,
  positiveInteger,
} from './primitives';

const keyCombination = v.pipe(v.array(nonBlankText), v.minLength(1));

const shortcutsSchema = jsonObject({
  format: v.literal('llsettings.shortcuts'),
  schemaVersion: positiveInteger,
  bindings: jsonRecord(nonBlankText, v.array(keyCombination)),
});

const shortcutsMigrations: readonly MigrationStep[] = [];

const shortcutsFormat: FileFormat<typeof shortcutsSchema> = {
  format: 'llsettings.shortcuts',
  schema: shortcutsSchema,
  migrations: shortcutsMigrations,
};

/**
 * `shortcuts.json`: only the shortcuts that differ from the defaults. Each
 * command id maps to its key combinations, such as `[["Ctrl", "1"]]`. An empty
 * list removes the shortcut. Command ids this version doesn't know are kept.
 */
export type ShortcutsFile = ReadonlyKnown<
  v.InferOutput<typeof shortcutsSchema>
>;

export function parseShortcuts(
  text: string,
  file: string,
): Result<LoadedFile<ShortcutsFile>, FileError> {
  return parseFile(shortcutsFormat, text, file);
}

export function serializeShortcuts(
  shortcuts: ShortcutsFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(shortcutsFormat, shortcuts, file);
}
