import * as v from 'valibot';
import {NO_LABEL_COLOR, paletteColors} from '../colors';
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
  isFirstWithKey,
  jsonObject,
  nonBlankText,
  positiveInteger,
} from './primitives';

const labelSchema = jsonObject({
  name: nonBlankText,
  color: v.picklist([...paletteColors, NO_LABEL_COLOR]),
  key: v.nullable(nonBlankText),
});

const labelsSchema = jsonObject({
  format: v.literal('llsettings.labels'),
  schemaVersion: positiveInteger,
  labels: v.pipe(
    v.array(labelSchema),
    v.checkItems(
      (_label, index, labels) =>
        isFirstWithKey(labels, index, ({name}) => name),
      'Another label already has this name',
    ),
  ),
});

const labelsMigrations: readonly MigrationStep[] = [];

const labelsFormat: FileFormat<typeof labelsSchema> = {
  format: 'llsettings.labels',
  schema: labelsSchema,
  migrations: labelsMigrations,
};

/** `labels.json`: the 이름표 list, in the order of the 이름표 menu. */
export type LabelsFile = ReadonlyKnown<v.InferOutput<typeof labelsSchema>>;

/** One 이름표, with its color and its jump key in 진행 (`null` for none). */
export type Label = LabelsFile['labels'][number];

export function parseLabels(
  text: string,
  file: string,
): Result<LoadedFile<LabelsFile>, FileError> {
  return parseFile(labelsFormat, text, file);
}

export function serializeLabels(
  labels: LabelsFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(labelsFormat, labels, file);
}
