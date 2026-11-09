import {sectionCardSchema} from './service';
import {songTitleLayoutSchema} from './songTitleLayout';
import {slideTransitionSchema} from './slideTransition';
import * as v from 'valibot';
import {layerKinds, type LayerKind, type LiveState} from '../live/state';
import type {Result} from '../common/result';
import {parsePayload, payloadObject, type PayloadError} from './payload';
import {
  macroIdSchema,
  mediaIdSchema,
  screenIdSchema,
  slideIdSchema,
  timerIdSchema,
} from './ids';
import {
  LIVE_STATE_LIMITS,
  liveTextSchema,
  liveNonBlankTextSchema,
  liveOutputsSchema,
} from './liveLimits';
import {activeMessagesSchema, activePropsSchema} from './overlayState';
import {timerRunsSchema} from './timerState';
import {audioPlaybackSchema} from './audioState';
import {percent, seconds} from './primitives';
import {clearEffectsSchema} from './clearFade';
import {outputMediaPropertiesSchema} from './outputMedia';
import {
  liveThemeItemSchema,
  liveThemeModeSchema,
  liveThemeOutputSchema,
} from './liveTheme';
import {themeItemKinds} from '../themes/elementRules';
import {SLIDES_LIMITS} from './service';

const id = v.pipe(v.string(), v.nonEmpty());
const count = v.pipe(v.number(), v.integer(), v.minValue(0));

export const biblePartSchema = v.pipe(count, v.minValue(1), v.maxValue(10_000));

const mediaChoiceEntries = {
  mediaId: id,
  loop: v.boolean(),
  itemId: v.exactOptional(liveNonBlankTextSchema),
  title: v.exactOptional(liveTextSchema),
  slidePicture: v.exactOptional(v.literal(true)),
};

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
    picture: v.exactOptional(mediaIdSchema),
    itemId: id,
    position: count,
    textSlideNumber: v.exactOptional(
      v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
        v.maxValue(SLIDES_LIMITS.slides),
      ),
    ),
    biblePart: v.exactOptional(biblePartSchema),
    sourceSlideId: v.exactOptional(slideIdSchema),
    transition: v.exactOptional(slideTransitionSchema),
    label: v.nullable(liveTextSchema),
    lines: slideLinesSchema,
    sectionCard: v.exactOptional(sectionCardSchema),
    titleSlide: v.exactOptional(v.literal(true)),
    titleLayout: v.exactOptional(songTitleLayoutSchema),
    continued: v.exactOptional(v.boolean()),
    reference: v.exactOptional(liveTextSchema),
    name: v.exactOptional(liveTextSchema),
    kind: v.exactOptional(v.picklist(themeItemKinds)),
    title: v.exactOptional(liveTextSchema),
    memo: v.exactOptional(liveTextSchema),
    next: v.exactOptional(
      payloadObject({
        label: v.nullable(liveTextSchema),
        lines: slideLinesSchema,
        continued: v.exactOptional(v.boolean()),
        biblePart: v.exactOptional(biblePartSchema),
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
} satisfies Record<LayerKind, v.GenericSchema>;

export const liveStateSchema = payloadObject({
  themeItem: v.exactOptional(v.nullable(liveThemeItemSchema)),
  themeMode: v.exactOptional(liveThemeModeSchema),
  themeOutput: v.exactOptional(liveThemeOutputSchema),
  lastMacroId: v.exactOptional(macroIdSchema),
  audioTrackVersion: v.exactOptional(
    v.pipe(count, v.maxValue(Number.MAX_SAFE_INTEGER)),
  ),
  audioVolume: v.exactOptional(percent),
  stageMessage: v.exactOptional(v.nullable(liveNonBlankTextSchema)),
  version: count,
  layers: payloadObject({
    media: v.nullable(layerSchemas.media),
    slide: v.nullable(layerSchemas.slide),
    prop: v.nullable(layerSchemas.prop),
    audio: v.nullable(layerSchemas.audio),
    message: v.nullable(layerSchemas.message),
  }),
  outputs: liveOutputsSchema,
  canUndo: v.boolean(),
  canRestoreItem: v.exactOptional(v.boolean()),
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
