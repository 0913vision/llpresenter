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
import {screenIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  finiteNumber,
  jsonObject,
  listWithUniqueIds,
  percent,
  pixelSize,
  positiveInteger,
  positiveNumber,
} from './primitives';

const displaySchema = jsonObject({
  id: v.pipe(v.number(), v.integer()),
  name: v.string(),
  number: positiveInteger,
  bounds: jsonObject({
    x: v.pipe(v.number(), v.integer()),
    y: v.pipe(v.number(), v.integer()),
    width: positiveInteger,
    height: positiveInteger,
  }),
  scaleFactor: positiveNumber,
});

const ndiSchema = jsonObject({
  sourceName: v.exactOptional(v.string()),
  resolution: v.exactOptional(pixelSize),
  fps: v.exactOptional(positiveNumber),
  alpha: v.exactOptional(v.boolean()),
  networkInterface: v.exactOptional(v.string()),
  group: v.exactOptional(v.string()),
});

const screenSchema = jsonObject({
  id: screenIdSchema,
  name: v.string(),
  kind: v.picklist(['audience', 'stage']),
  method: v.picklist(['fullscreen', 'window', 'capture', 'ndi']),
  display: v.exactOptional(displaySchema),
  resolution: v.exactOptional(pixelSize),
  onDisconnect: v.exactOptional(v.picklist(['window', 'off'])),
  alwaysOnTop: v.exactOptional(v.boolean()),
  preventSleep: v.exactOptional(v.boolean()),
  edgeMargin: v.exactOptional(percent),
  offset: v.exactOptional(jsonObject({x: finiteNumber, y: finiteNumber})),
  previewBackground: v.exactOptional(v.picklist(['green', 'black', 'checker'])),
  ndi: v.exactOptional(ndiSchema),
});

const screensSchema = jsonObject({
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
 * One output screen. An absent optional field means its default: the
 * 환경설정 output values for `onDisconnect`, `alwaysOnTop`, and
 * `preventSleep`, no edge margin or offset, a green preview background, and
 * 1920 x 1080 for a capture window. A full screen without `display` is
 * unassigned.
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
