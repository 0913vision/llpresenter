import * as v from 'valibot';
import type {LayerKind, LiveState} from '../live';
import type {Result} from '../result';
import {parsePayload, payloadObject, type PayloadError} from './payload';
import {nonBlankText} from './primitives';
import {lookIdSchema} from './ids';
import {
  activeMessagesSchema,
  activePropsSchema,
  noticePlaybackSchema,
} from './overlayState';

const id = v.pipe(v.string(), v.nonEmpty());
const count = v.pipe(v.number(), v.integer(), v.minValue(0));

const mediaChoiceEntries = {mediaId: id, loop: v.boolean()};

/** A background media choice, as `media.show` carries it. */
export const mediaChoiceSchema = payloadObject(mediaChoiceEntries);

/** The live layers, by kind, as windows receive them and send them. */
export const layerSchemas = {
  media: payloadObject({
    ...mediaChoiceEntries,
    startedAt: v.pipe(v.number(), v.finite()),
  }),
  slide: payloadObject({
    itemId: id,
    position: count,
    label: v.nullable(v.string()),
    lines: v.array(v.string()),
  }),
  prop: payloadObject({propId: id, items: v.exactOptional(activePropsSchema)}),
  audio: payloadObject({mediaId: id}),
  message: payloadObject({
    messageId: id,
    text: v.string(),
    items: v.exactOptional(activeMessagesSchema),
  }),
  notice: payloadObject({
    noticeId: id,
    playback: v.exactOptional(noticePlaybackSchema),
  }),
} satisfies Record<LayerKind, v.GenericSchema>;

export const liveStateSchema = payloadObject({
  lookId: v.exactOptional(v.nullable(lookIdSchema)),
  stageMessage: v.exactOptional(v.nullable(nonBlankText)),
  version: count,
  layers: payloadObject({
    media: v.nullable(layerSchemas.media),
    slide: v.nullable(layerSchemas.slide),
    prop: v.nullable(layerSchemas.prop),
    audio: v.nullable(layerSchemas.audio),
    message: v.nullable(layerSchemas.message),
    notice: v.nullable(layerSchemas.notice),
  }),
  outputs: v.record(v.string(), v.boolean()),
  canUndo: v.boolean(),
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
