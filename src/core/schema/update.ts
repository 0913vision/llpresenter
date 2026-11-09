import * as v from 'valibot';
import {parsePayload, payloadObject, plainObject} from './payload';

/** One update operation and one visible result, with bounded IPC strings. */
export const UPDATE_LIMITS = {version: 64, reason: 240, percent: 100} as const;

const revision = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(Number.MAX_SAFE_INTEGER),
);
const version = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(UPDATE_LIMITS.version),
  v.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u),
);
const status = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('idle')}),
    v.object({kind: v.literal('unsupported')}),
    v.object({kind: v.literal('checking')}),
    v.object({kind: v.literal('available'), version}),
    v.object({
      kind: v.literal('downloading'),
      version,
      percent: v.pipe(
        v.number(),
        v.integer(),
        v.minValue(0),
        v.maxValue(UPDATE_LIMITS.percent),
      ),
    }),
    v.object({kind: v.literal('downloaded'), version}),
    v.object({kind: v.literal('installing'), version}),
    v.object({kind: v.literal('latest'), version}),
    v.object({
      kind: v.literal('error'),
      reason: v.pipe(
        v.string(),
        v.minLength(1),
        v.maxLength(UPDATE_LIMITS.reason),
      ),
    }),
  ]),
);
const snapshot = payloadObject({
  revision,
  status,
  visible: v.boolean(),
  outputsOn: v.boolean(),
  busy: v.boolean(),
});
const action = payloadObject({
  revision,
  action: v.picklist(['download', 'install', 'later', 'dismiss']),
});

export type UpdateStatus = Readonly<v.InferOutput<typeof status>>;
export type UpdateSnapshot = Readonly<v.InferOutput<typeof snapshot>>;
export type UpdateAction = Readonly<v.InferOutput<typeof action>>;

export function parseUpdateSnapshot(value: unknown) {
  return parsePayload(snapshot, value);
}

export function parseUpdateAction(value: unknown) {
  return parsePayload(action, value);
}

/** Checks the only release metadata the app exposes to its windows. */
export function parseUpdateVersion(value: unknown) {
  return parsePayload(version, value);
}
