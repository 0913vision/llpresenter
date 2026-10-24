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
import {macroCollectionIdSchema, screenIdSchema, serviceIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {nonNegativeNumber, positiveInteger, timestamp} from './primitives';

const columnLayoutSchema = v.looseObject({
  left: v.exactOptional(nonNegativeNumber),
  right: v.exactOptional(nonNegativeNumber),
  columns: v.exactOptional(positiveInteger),
});

const sizeClassLayout = v.exactOptional(columnLayoutSchema);

const appConfigSchema = v.looseObject({
  format: v.literal('llapp'),
  schemaVersion: positiveInteger,
  dataRoot: v.exactOptional(v.string()),
  songsPath: v.exactOptional(v.string()),
  mediaPath: v.exactOptional(v.string()),
  backupPath: v.exactOptional(v.string()),
  lastServiceId: v.exactOptional(serviceIdSchema),
  layout: v.exactOptional(
    v.looseObject({
      narrow: sizeClassLayout,
      normal: sizeClassLayout,
      wide: sizeClassLayout,
    }),
  ),
  previewBig: v.exactOptional(screenIdSchema),
  macroView: v.exactOptional(v.picklist(['grid', 'list'])),
  macroCollection: v.exactOptional(macroCollectionIdSchema),
  mediaStrip: v.exactOptional(v.boolean()),
  lastBackupAt: v.exactOptional(timestamp),
});

const appConfigMigrations: readonly MigrationStep[] = [];

const appConfigFormat: FileFormat<typeof appConfigSchema> = {
  format: 'llapp',
  schema: appConfigSchema,
  migrations: appConfigMigrations,
};

/**
 * `app.json` in the app data folder: the data locations, which the app needs
 * before it reads any data, and the window state. Empty paths mean the default
 * folders.
 */
export type AppConfig = ReadonlyKnown<v.InferOutput<typeof appConfigSchema>>;

export type AppLayout = NonNullable<AppConfig['layout']>;

/** The window size classes of the design system `Layout`. */
export type SizeClass = keyof AppLayout;

/**
 * The column widths (px) and thumbnail columns that the operator set for one
 * size class. An absent value means the class default. The shell clamps the
 * values to their ranges.
 */
export type ColumnLayout = NonNullable<AppLayout[SizeClass]>;

export function parseAppConfig(
  text: string,
  file: string,
): Result<LoadedFile<AppConfig>, FileError> {
  return parseFile(appConfigFormat, text, file);
}

export function serializeAppConfig(
  config: AppConfig,
  file: string,
): Result<string, FileError> {
  return serializeFile(appConfigFormat, config, file);
}
