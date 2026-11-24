import * as v from 'valibot';
import {slideTransitionSchema} from '../slides/slideTransition';
import {layerKinds, type LayerKind, type LiveState} from './live';
import type {Result} from '@core/common/result';
import {AUTO_TOKENS} from '../slides/slideContent';
import {
  parsePayload,
  payloadObject,
  type PayloadError,
} from '../common/payload';
import {
  macroIdSchema,
  screenIdSchema,
  slideIdSchema,
  themeIdSchema,
  timerIdSchema,
} from '../common/ids';
import {
  LIVE_STATE_LIMITS,
  liveTextSchema,
  liveNonBlankTextSchema,
  liveOutputsSchema,
} from './liveLimits';
import {activeMessagesSchema, activePropsSchema} from './overlayState';
import {timerRunsSchema} from '../tools/timerState';
import {audioPlaybackSchema} from '../media/audioState';
import {percent, seconds} from '../common/primitives';
import {clearEffectsSchema} from './clearFade';
import {outputMediaPropertiesSchema} from '../media/outputMedia';
import {
  liveItemKinds,
  liveItemSchema,
  liveThemeModeSchema,
  liveThemeOutputSchema,
} from './liveTheme';
import {
  bibleVerseReferenceSchema,
  SLIDE_LIMITS,
  slideTextsSchema,
} from '../slides/slide';
import {slideBackgroundSchema} from '../screens/theme';

const id = v.pipe(v.string(), v.nonEmpty());
const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const liveVersion = v.pipe(count, v.maxValue(Number.MAX_SAFE_INTEGER));

/** Checks the version acknowledged by the control renderer. */
export function parseLiveVersion(value: unknown) {
  return parsePayload(liveVersion, value);
}

const mediaChoiceEntries = {
  mediaId: id,
  loop: v.boolean(),
  itemId: v.exactOptional(liveNonBlankTextSchema),
  title: v.exactOptional(liveTextSchema),
  chosen: v.exactOptional(v.literal(true)),
};

/** The value of each auto token of a slide, as a text. */
export const autoValuesSchema = payloadObject(
  v.entriesFromList(
    Object.values(AUTO_TOKENS),
    v.exactOptional(liveTextSchema),
  ),
);

const slidePeerSchema = payloadObject({
  texts: slideTextsSchema,
  auto: autoValuesSchema,
  continued: v.exactOptional(v.boolean()),
});

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
    slideId: slideIdSchema,
    position: count,
    sequenceLength: v.exactOptional(
      v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
        v.maxValue(SLIDE_LIMITS.slides),
      ),
    ),
    kind: v.exactOptional(v.picklist(liveItemKinds)),
    title: v.exactOptional(liveTextSchema),
    theme: themeIdSchema,
    texts: slideTextsSchema,
    auto: autoValuesSchema,
    continued: v.exactOptional(v.literal(true)),
    background: v.exactOptional(slideBackgroundSchema),
    next: v.nullable(liveTextSchema),
    peers: v.exactOptional(
      v.pipe(
        v.array(slidePeerSchema),
        v.maxLength(LIVE_STATE_LIMITS.slidePeers),
      ),
    ),
    verse: v.exactOptional(bibleVerseReferenceSchema),
    transition: v.exactOptional(slideTransitionSchema),
    transitionStartedAt: v.exactOptional(v.pipe(v.number(), v.finite())),
    reverseTransition: v.exactOptional(v.nullable(slideTransitionSchema)),
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

/**
 * The live output state as windows receive it: the item, theme, layers, which
 * outputs are on, the clear and undo state, the timers, and the test patterns.
 * Every list and text in it is bounded.
 */
export const liveStateSchema = payloadObject({
  waitingForControl: v.exactOptional(v.literal(true)),
  item: v.exactOptional(v.nullable(liveItemSchema)),
  themeMode: v.exactOptional(liveThemeModeSchema),
  themeOutput: v.exactOptional(liveThemeOutputSchema),
  lastMacroId: v.exactOptional(macroIdSchema),
  audioTrackVersion: v.exactOptional(
    v.pipe(count, v.maxValue(Number.MAX_SAFE_INTEGER)),
  ),
  audioVolume: v.exactOptional(percent),
  stageMessage: v.exactOptional(v.nullable(liveNonBlankTextSchema)),
  version: count,
  blackScreen: v.exactOptional(v.boolean()),
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
