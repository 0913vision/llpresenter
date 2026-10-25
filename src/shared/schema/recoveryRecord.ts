import * as v from 'valibot';
import {isRecord} from '../guards';
import type {Result} from '../result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {serviceIdSchema} from './ids';
import {liveStateSchema} from './liveState';
import {LIVE_STATE_LIMITS} from './liveLimits';
import {jsonObject, positiveInteger, timestamp} from './primitives';

export const RECOVERY_RECORD_LIMITS = LIVE_STATE_LIMITS;

function retainUnknownFields(source: unknown, target: unknown): void {
  if (Array.isArray(source) && Array.isArray(target)) {
    const inputs: readonly unknown[] = source;
    const outputs: readonly unknown[] = target;
    for (const [index, output] of outputs.entries()) {
      retainUnknownFields(inputs[index], output);
    }
    return;
  }
  if (!isRecord(source) || !isRecord(target)) return;
  for (const [key, value] of Object.entries(source)) {
    if (Object.hasOwn(target, key)) {
      retainUnknownFields(value, target[key]);
    } else {
      Object.defineProperty(target, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
}

const fileStateSchema = v.pipe(
  v.unknown(),
  v.rawTransform(({dataset, addIssue, NEVER}) => {
    const parsed = v.safeParse(liveStateSchema, dataset.value, {
      abortEarly: true,
    });
    if (!parsed.success) {
      const [issue] = parsed.issues;
      addIssue({message: issue.message, path: issue.path});
      return NEVER;
    }
    retainUnknownFields(dataset.value, parsed.output);
    return parsed.output;
  }),
);

const recoveryRecordSchema = jsonObject({
  format: v.literal('llrecovery'),
  schemaVersion: positiveInteger,
  savedAt: timestamp,
  serviceId: v.nullable(serviceIdSchema),
  state: fileStateSchema,
});

const recoveryRecordFormat: FileFormat<typeof recoveryRecordSchema> = {
  format: 'llrecovery',
  schema: recoveryRecordSchema,
  migrations: [],
};

/** The versioned live.json wrapper; output owns restore eligibility and clock rebasing. */
export type RecoveryRecord = ReadonlyKnown<
  v.InferOutput<typeof recoveryRecordSchema>
>;

function oversized(file: string): Result<never, FileError> {
  return {
    ok: false,
    error: {
      kind: 'invalid',
      file,
      field: '',
      message: 'The recovery record exceeds its byte limit',
    },
  };
}

function fitsBytes(text: string): boolean {
  return (
    text.length <= RECOVERY_RECORD_LIMITS.bytes &&
    new TextEncoder().encode(text).byteLength <= RECOVERY_RECORD_LIMITS.bytes
  );
}

export function parseRecoveryRecord(
  text: string,
  file = 'live.json',
): Result<LoadedFile<RecoveryRecord>, FileError> {
  return fitsBytes(text)
    ? parseFile(recoveryRecordFormat, text, file)
    : oversized(file);
}

export function serializeRecoveryRecord(
  record: RecoveryRecord,
  file = 'live.json',
): Result<string, FileError> {
  const serialized = serializeFile(recoveryRecordFormat, record, file);
  return serialized.ok && !fitsBytes(serialized.value)
    ? oversized(file)
    : serialized;
}
