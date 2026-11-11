import * as v from 'valibot';
import {monitorIdentitySchema} from './monitorIdentity';
import type {Result} from '../common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {messageStyleIdSchema, screenIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  hexColor,
  listWithUniqueIds,
  percent,
  pixelCount,
  pixelPosition,
  pixelSize,
  positiveInteger,
  positiveNumber,
  wholePixelPosition,
} from './primitives';

const displaySchema = jsonObject({
  identity: v.exactOptional(monitorIdentitySchema),
  id: v.pipe(v.number(), v.integer()),
  name: v.string(),
  number: positiveInteger,
  bounds: jsonObject({
    x: wholePixelPosition,
    y: wholePixelPosition,
    width: pixelCount,
    height: pixelCount,
  }),
  scaleFactor: positiveNumber,
});

/** Default name advertised by the broadcast sender. */
export const NDI_DEFAULT_SOURCE_NAME = 'LOVELIGHT 방송 화면';

/** Maximum NDI source-name length in characters. */
export const NDI_SOURCE_NAME_MAX = 64;

const ndiSchema = jsonObject({
  sourceName: v.exactOptional(
    v.pipe(v.string(), v.maxLength(NDI_SOURCE_NAME_MAX)),
  ),
  resolution: v.exactOptional(pixelSize),
  fps: v.exactOptional(positiveNumber),
  alpha: v.exactOptional(v.boolean()),
  hardwareAcceleration: v.exactOptional(v.boolean()),
  networkInterface: v.exactOptional(v.string()),
  group: v.exactOptional(v.string()),
});

export const screenSchema = jsonObject({
  id: screenIdSchema,
  name: v.string(),
  kind: v.picklist(['audience', 'broadcast', 'stage']),
  messageStyleId: v.exactOptional(messageStyleIdSchema),
  method: v.picklist(['fullscreen', 'window', 'capture', 'ndi']),
  emptyColor: v.exactOptional(hexColor),
  display: v.exactOptional(displaySchema),
  resolution: v.exactOptional(pixelSize),
  onDisconnect: v.exactOptional(v.picklist(['window', 'off'])),
  alwaysOnTop: v.exactOptional(v.boolean()),
  edgeMargin: v.exactOptional(percent),
  offset: v.exactOptional(jsonObject({x: pixelPosition, y: pixelPosition})),
  previewBackground: v.exactOptional(v.picklist(['green', 'black', 'checker'])),
  ndi: v.exactOptional(ndiSchema),
});

export const screensSchema = jsonObject({
  format: v.literal('llsettings.screens'),
  schemaVersion: positiveInteger,
  screens: listWithUniqueIds(screenSchema),
});

const screensMigrations: readonly MigrationStep[] = [];

const screensFormat: FileFormat<typeof screensSchema> = {
  format: 'llsettings.screens',
  schema: screensSchema,
  migrations: screensMigrations,
};

/** `screens.json`: the output screens in list order. */
export type ScreensFile = ReadonlyKnown<v.InferOutput<typeof screensSchema>>;

/**
 * One output screen. An absent optional field means its default: 창으로
 * 바꾸기 for `onDisconnect`, off for `alwaysOnTop`, no edge margin or offset,
 * a green preview background, and 1920 x 1080 for a capture window. A full
 * screen without `display` is unassigned.
 */
export type Screen = ScreensFile['screens'][number];

export function parseScreens(
  text: string,
  file: string,
): Result<LoadedFile<ScreensFile>, FileError> {
  return parseFile(screensFormat, text, file);
}

export function serializeScreens(
  screens: ScreensFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(screensFormat, screens, file);
}
