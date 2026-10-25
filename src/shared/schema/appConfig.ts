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
import {UI_ZOOM, uiZoomPercentSchema} from './uiZoom';
import {
  jsonObject,
  nonNegativeNumber,
  positiveInteger,
  timestamp,
} from './primitives';

const columnLayoutSchema = jsonObject({
  left: v.exactOptional(nonNegativeNumber),
  right: v.exactOptional(nonNegativeNumber),
  columns: v.exactOptional(positiveInteger),
  thumbnailScalePercent: v.exactOptional(positiveInteger),
});

const sizeClassLayout = v.exactOptional(columnLayoutSchema);

/** The window size classes of the design system `Layout`. */
export const sizeClasses = ['narrow', 'normal', 'wide'] as const;

/** The column layouts of the size classes, as `app.json` and `ui:get` hold them. */
export const appLayoutSchema = jsonObject({
  narrow: sizeClassLayout,
  normal: sizeClassLayout,
  wide: sizeClassLayout,
});

const appConfigSchema = jsonObject({
  format: v.literal('llapp'),
  schemaVersion: positiveInteger,
  dataRoot: v.exactOptional(v.string()),
  songsPath: v.exactOptional(v.string()),
  mediaPath: v.exactOptional(v.string()),
  backupPath: v.exactOptional(v.string()),
  lastServiceId: v.exactOptional(serviceIdSchema),
  uiZoomPercent: v.exactOptional(
    v.fallback(uiZoomPercentSchema, UI_ZOOM.defaultPercent),
  ),
  layout: v.exactOptional(appLayoutSchema),
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

export type SizeClass = (typeof sizeClasses)[number];

/**
 * The column widths (px), thumbnail scale (%), and legacy thumbnail columns
 * saved for one size class. An absent value means the class default. The
 * shell clamps the values to their ranges when reading them.
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
