import * as v from 'valibot';
import {NO_LABEL_COLOR, paletteColors} from '../colors';
import {isRecord} from '../guards';
import type {Result} from '../result';
import {
  checkPart,
  parseFile,
  serializeFile,
  type DroppedValue,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type PrunedContent,
  type ReadonlyKnown,
} from './fileFormat';
import type {MigrationStep} from './migration';
import {
  isFirstWithKey,
  jsonObject,
  nonBlankText,
  positiveInteger,
} from './primitives';

const JUMP_KEY = /^(Key[A-Z]|Digit\d)$/;

/** A jump key: the `KeyboardEvent.code` of a letter or digit key. */
const jumpKeySchema = v.nullable(
  v.pipe(
    v.string(),
    v.regex(JUMP_KEY, 'Expected the code of a letter or digit, such as KeyC'),
  ),
);

const labelSchema = jsonObject({
  name: nonBlankText,
  color: v.picklist([...paletteColors, NO_LABEL_COLOR]),
  key: jumpKeySchema,
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
  prune: dropInvalidJumpKeys,
};

/** `labels.json`: the 이름표 list, in the order of the 이름표 menu. */
export type LabelsFile = ReadonlyKnown<v.InferOutput<typeof labelsSchema>>;

/**
 * One 이름표, with its color and its jump key in 진행: the code of a letter or
 * digit key, such as `KeyC`, or `null` for none.
 */
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

function dropInvalidJumpKeys(
  content: Readonly<Record<string, unknown>>,
): PrunedContent {
  const labels = content['labels'];
  if (!Array.isArray(labels)) {
    return {content, dropped: []};
  }
  const dropped: DroppedValue[] = [];
  const items: readonly unknown[] = labels;
  const kept = items.map((label, index) => {
    if (!isRecord(label)) {
      return label;
    }
    const key = checkPart(jumpKeySchema, label['key']);
    if (key.ok) {
      return label;
    }
    dropped.push({field: `labels.${index}.key`, message: key.error.message});
    return {...label, key: null};
  });
  return {content: {...content, labels: kept}, dropped};
}
