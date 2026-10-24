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
import {stageElementIdSchema, stageLayoutIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  finiteNumber,
  hexColor,
  listWithUniqueIds,
  nonNegativeNumber,
  positiveInteger,
} from './primitives';
import {textStyleEntries} from './textStyle';

const OPACITY_MAX = 1;

/** What a stage layout element draws. */
export const stageElementKinds = [
  'currentSlide',
  'nextSlide',
  'currentLabel',
  'nextLabel',
  'clock',
  'timer',
  'stageMessage',
] as const;

const elementSchema = v.looseObject({
  id: stageElementIdSchema,
  name: v.string(),
  kind: v.picklist(stageElementKinds),
  show: v.exactOptional(v.picklist(['text', 'image', 'memo'])),
  frame: v.looseObject({
    x: finiteNumber,
    y: finiteNumber,
    w: nonNegativeNumber,
    h: nonNegativeNumber,
  }),
  text: v.exactOptional(
    v.looseObject({...textStyleEntries, autoFit: v.boolean()}),
  ),
  box: v.exactOptional(
    v.looseObject({
      background: v.exactOptional(hexColor),
      opacity: v.exactOptional(
        v.pipe(nonNegativeNumber, v.maxValue(OPACITY_MAX)),
      ),
    }),
  ),
});

const layoutSchema = v.looseObject({
  id: stageLayoutIdSchema,
  name: v.string(),
  width: positiveInteger,
  height: positiveInteger,
  elements: listWithUniqueIds(elementSchema),
});

const stageLayoutsSchema = v.looseObject({
  format: v.literal('llsettings.stage'),
  schemaVersion: positiveInteger,
  layouts: listWithUniqueIds(layoutSchema),
});

const stageLayoutsMigrations: readonly MigrationStep[] = [];

const stageLayoutsFormat: FileFormat<typeof stageLayoutsSchema> = {
  format: 'llsettings.stage',
  schema: stageLayoutsSchema,
  migrations: stageLayoutsMigrations,
};

/** `stage-layouts.json`: the layouts of the 무대 화면. */
export type StageLayoutsFile = ReadonlyKnown<
  v.InferOutput<typeof stageLayoutsSchema>
>;

export type StageLayout = StageLayoutsFile['layouts'][number];

/**
 * One element of a stage layout, framed in canvas pixels. `show` applies to 장
 * elements only.
 */
export type StageElement = StageLayout['elements'][number];

export function parseStageLayouts(
  text: string,
  file: string,
): Result<LoadedFile<StageLayoutsFile>, FileError> {
  return parseFile(stageLayoutsFormat, text, file);
}

export function serializeStageLayouts(
  layouts: StageLayoutsFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(stageLayoutsFormat, layouts, file);
}
