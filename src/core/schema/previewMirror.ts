import * as v from 'valibot';
import {parsePayload, payloadObject} from './payload';

const requestSchema = payloadObject({
  screenId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(100)),
});

const controlSchema = payloadObject({
  screenId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(100)),
  action: v.picklist(['start', 'stop', 'ack']),
});

const frameSchema = payloadObject({
  screenId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(100)),
  frame: v.nullable(
    v.pipe(
      v.instance(Uint8Array),
      v.check(value => value.length === 640 * 360 * 4),
    ),
  ),
});

const relaySchema = payloadObject({
  screenId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(100)),
  enabled: v.boolean(),
});

export type PreviewControl = Readonly<v.InferOutput<typeof controlSchema>>;
export type PreviewFrame = Readonly<v.InferOutput<typeof frameSchema>>;
export type PreviewRelay = Readonly<v.InferOutput<typeof relaySchema>>;

const sourceSchema = v.nullable(
  v.union([
    v.literal('alpha'),
    v.literal('relay'),
    v.pipe(v.string(), v.maxLength(128), v.regex(/^[A-Za-z0-9+/]{22}==$/)),
  ]),
);

export function parsePreviewSource(value: unknown) {
  return parsePayload(sourceSchema, value);
}

export function parsePreviewRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

export function parsePreviewControl(value: unknown) {
  return parsePayload(controlSchema, value);
}

export function parsePreviewFrame(value: unknown) {
  return parsePayload(frameSchema, value);
}

export function parsePreviewRelay(value: unknown) {
  return parsePayload(relaySchema, value);
}
