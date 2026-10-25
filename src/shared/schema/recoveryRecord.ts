import * as v from 'valibot';
import {isRecord} from '../guards';
import type {LiveState} from '../live';
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
import {MAX_TARGET_SCREENS} from './overlayState';
import {jsonObject, positiveInteger, timestamp} from './primitives';

export const RECOVERY_RECORD_LIMITS = {
  bytes: 4 * 1024 * 1024,
  outputs: MAX_TARGET_SCREENS,
  slideLines: 1000,
  textCharacters: 4000,
} as const;

function textsFit(state: LiveState): boolean {
  const {slide, message, prop} = state.layers;
  const texts = [
    state.stageMessage,
    slide?.label,
    ...(slide?.lines ?? []),
    message?.text,
    ...(message?.items ?? []).map(item => item.text),
    ...(prop?.items ?? []).flatMap(item =>
      item.content.kind === 'text' ? [item.content.text] : [],
    ),
  ];
  return texts.every(
    text =>
      text == null || text.length <= RECOVERY_RECORD_LIMITS.textCharacters,
  );
}

const boundedStateSchema = v.pipe(
  liveStateSchema,
  v.forward(
    v.check(
      state =>
        Object.keys(state.outputs).length <= RECOVERY_RECORD_LIMITS.outputs,
      'Too many saved outputs',
    ),
    ['outputs'],
  ),
  v.forward(
    v.check(
      state =>
        (state.layers.slide?.lines.length ?? 0) <=
        RECOVERY_RECORD_LIMITS.slideLines,
      'Too many saved slide lines',
    ),
    ['layers', 'slide'],
  ),
  v.check(state => textsFit(state), 'Saved text is too long'),
);

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
    const parsed = v.safeParse(boundedStateSchema, dataset.value, {
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
