import * as v from 'valibot';
import {parsePayload, payloadObject} from '../common/payload';

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

/**
 * A window's request to start or stop the preview stream of a screen, or its
 * acknowledgment (`ack`) of a frame.
 */
export type PreviewControl = Readonly<v.InferOutput<typeof controlSchema>>;
/**
 * One picture of a screen's preview: 640 by 360 pixels as RGBA bytes, null
 * when the screen has no picture.
 */
export type PreviewFrame = Readonly<v.InferOutput<typeof frameSchema>>;
/**
 * Whether the window that captures a screen's preview should pass its frames
 * on to the other windows.
 */
export type PreviewRelay = Readonly<v.InferOutput<typeof relaySchema>>;

const sourceSchema = v.nullable(
  v.union([
    v.literal('alpha'),
    v.literal('relay'),
    v.pipe(v.string(), v.maxLength(128), v.regex(/^[A-Za-z0-9+/]{22}==$/)),
  ]),
);

/**
 * Checks the answer to a preview source request: `alpha` or `relay` for a
 * picture main sends, a media source id for a window that captures it, or null
 * for none.
 */
export function parsePreviewSource(value: unknown) {
  return parsePayload(sourceSchema, value);
}

/** Checks the screen id of a preview source request. */
export function parsePreviewRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

/** Checks a preview control message. */
export function parsePreviewControl(value: unknown) {
  return parsePayload(controlSchema, value);
}

/** Checks a preview frame; its size must be exactly 640 by 360 RGBA. */
export function parsePreviewFrame(value: unknown) {
  return parsePayload(frameSchema, value);
}

/** Checks a preview relay message. */
export function parsePreviewRelay(value: unknown) {
  return parsePayload(relaySchema, value);
}
