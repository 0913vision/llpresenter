import * as v from 'valibot';
import {layerKinds, type LayerKind, type LiveState} from '../live/state';
import type {Result} from '../common/result';
import {parsePayload, payloadObject, type PayloadError} from './payload';
import {
  lookIdSchema,
  macroIdSchema,
  screenIdSchema,
  stageLayoutIdSchema,
  timerIdSchema,
} from './ids';
import {
  LIVE_STATE_LIMITS,
  liveTextSchema,
  liveNonBlankTextSchema,
  liveOutputsSchema,
} from './liveLimits';
import {
  activeMessagesSchema,
  activePropsSchema,
  noticePlaybackSchema,
} from './overlayState';
import {timerRunsSchema} from './timerState';
import {audioPlaybackSchema} from './audioState';
import {percent, seconds} from './primitives';
import {clearEffectsSchema} from './clearFade';
import {outputMediaPropertiesSchema} from './outputMedia';

const id = v.pipe(v.string(), v.nonEmpty());
const count = v.pipe(v.number(), v.integer(), v.minValue(0));

const mediaChoiceEntries = {mediaId: id, loop: v.boolean()};

const slideLinesSchema = v.pipe(
  v.array(liveTextSchema),
  v.maxLength(LIVE_STATE_LIMITS.slideLines),
);

/** A background media choice, as `media.show` carries it. */
export const mediaChoiceSchema = payloadObject(mediaChoiceEntries);

/** The live layers, by kind, as windows receive them and send them. */
export const layerSchemas = {
  media: payloadObject({
    ...mediaChoiceEntries,
    startedAt: v.pipe(v.number(), v.finite()),
    positionSeconds: v.exactOptional(seconds),
    properties: v.exactOptional(outputMediaPropertiesSchema),
  }),
  slide: payloadObject({
    itemId: id,
    position: count,
    label: v.nullable(liveTextSchema),
    lines: slideLinesSchema,
    reference: v.exactOptional(liveTextSchema),
    next: v.exactOptional(
      payloadObject({
        label: v.nullable(liveTextSchema),
        lines: slideLinesSchema,
      }),
    ),
  }),
  prop: payloadObject({propId: id, items: v.exactOptional(activePropsSchema)}),
  audio: payloadObject({
    mediaId: id,
    playback: v.exactOptional(audioPlaybackSchema),
    properties: v.exactOptional(outputMediaPropertiesSchema),
  }),
  message: payloadObject({
    messageId: id,
    text: liveTextSchema,
    items: v.exactOptional(activeMessagesSchema),
  }),
  notice: payloadObject({
    noticeId: id,
    playback: v.exactOptional(noticePlaybackSchema),
  }),
} satisfies Record<LayerKind, v.GenericSchema>;

export const liveStateSchema = payloadObject({
  lastMacroId: v.exactOptional(macroIdSchema),
  audioTrackVersion: v.exactOptional(
    v.pipe(count, v.maxValue(Number.MAX_SAFE_INTEGER)),
  ),
  audioVolume: v.exactOptional(percent),
  lookId: v.exactOptional(v.nullable(lookIdSchema)),
  stageMessage: v.exactOptional(v.nullable(liveNonBlankTextSchema)),
  version: count,
  layers: payloadObject({
    media: v.nullable(layerSchemas.media),
    slide: v.nullable(layerSchemas.slide),
    prop: v.nullable(layerSchemas.prop),
    audio: v.nullable(layerSchemas.audio),
    message: v.nullable(layerSchemas.message),
    notice: v.nullable(layerSchemas.notice),
  }),
  outputs: liveOutputsSchema,
  canUndo: v.boolean(),
  clearEffects: v.exactOptional(clearEffectsSchema),
  clearToggles: v.exactOptional(
    v.pipe(
      v.array(v.picklist(['all', ...layerKinds])),
      v.maxLength(layerKinds.length + 1),
      v.check(
        targets => new Set(targets).size === targets.length,
        'Expected each clear key once',
      ),
    ),
  ),
  timers: v.exactOptional(timerRunsSchema),
  testPatterns: v.exactOptional(
    v.pipe(
      v.array(screenIdSchema),
      v.maxLength(LIVE_STATE_LIMITS.outputs),
      v.check(
        screens => new Set(screens).size === screens.length,
        'Expected each screen once',
      ),
    ),
  ),
  stageLayouts: v.exactOptional(
    v.pipe(
      v.record(screenIdSchema, stageLayoutIdSchema),
      v.maxEntries(LIVE_STATE_LIMITS.outputs),
    ),
  ),
  stageTimerId: v.exactOptional(timerIdSchema),
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
