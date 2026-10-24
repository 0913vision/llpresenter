import * as v from 'valibot';
import type {LayerKind, LiveState} from '../live';
import type {Result} from '../result';
import {parsePayload, payloadObject, type PayloadError} from './payload';

const id = v.pipe(v.string(), v.nonEmpty());
const count = v.pipe(v.number(), v.integer(), v.minValue(0));

const layerSchemas = {
  media: v.object({
    mediaId: id,
    loop: v.boolean(),
    startedAt: v.exactOptional(v.pipe(v.number(), v.finite())),
  }),
  slide: v.object({
    itemId: id,
    position: count,
    label: v.nullable(v.string()),
    lines: v.array(v.string()),
  }),
  prop: v.object({propId: id}),
  audio: v.object({mediaId: id}),
  message: v.object({messageId: id, text: v.string()}),
  notice: v.object({noticeId: id}),
} satisfies Record<LayerKind, v.GenericSchema>;

const liveStateSchema = payloadObject({
  version: count,
  layers: v.object({
    media: v.nullable(layerSchemas.media),
    slide: v.nullable(layerSchemas.slide),
    prop: v.nullable(layerSchemas.prop),
    audio: v.nullable(layerSchemas.audio),
    message: v.nullable(layerSchemas.message),
    notice: v.nullable(layerSchemas.notice),
  }),
  outputs: v.record(v.string(), v.boolean()),
});

/**
 * Checks a live state that arrived from the main process, so a window never
 * draws a malformed one. Never throws.
 */
export function parseLiveState(
  value: unknown,
): Result<LiveState, PayloadError> {
  return parsePayload(liveStateSchema, value);
}
