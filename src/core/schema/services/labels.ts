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
} from '../common/fileFormat';
import type {MigrationStep} from '../common/migration';
import {jsonObject, nonBlankText, positiveInteger} from '../common/primitives';
import {uniqueNames} from '../common/uniqueNames';

const labelSchema = jsonObject({
  name: nonBlankText,
  color: labelColorSchema,
});

/** `labels.json` as its file holds it; no two 이름표 share a name. */
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

/** One 이름표: its name and its color. */
export type Label = LabelsFile['labels'][number];

/** Reads the text of `labels.json`. `file` names it in errors. */
export function parseLabels(
  text: string,
  file: string,
): Result<LoadedFile<LabelsFile>, FileError> {
  return parseFile(labelsFormat, text, file);
}

/** Writes the 이름표 as the text of `labels.json`. `file` names it in errors. */
export function serializeLabels(
  labels: LabelsFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(labelsFormat, labels, file);
}
