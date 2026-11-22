import * as v from 'valibot';
import {labelColorSchema} from './labelColor';
import type {Result} from '@core/common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import type {MigrationStep} from './migration';
import {jsonObject, nonBlankText, positiveInteger} from './primitives';
import {uniqueNames} from './uniqueNames';

const labelSchema = jsonObject({
  name: nonBlankText,
  color: labelColorSchema,
});

export const labelsSchema = jsonObject({
  format: v.literal('llsettings.labels'),
  schemaVersion: positiveInteger,
  defaultVerseLabelVersion: v.exactOptional(positiveInteger),
  labels: v.pipe(
    v.array(labelSchema),
    uniqueNames<v.InferOutput<typeof labelSchema>>(
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
