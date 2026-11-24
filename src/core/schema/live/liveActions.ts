import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {
  audioPlaylistIdSchema,
  macroIdSchema,
  mediaIdSchema,
  propIdSchema,
  serviceItemIdSchema,
  timerIdSchema,
  themeIdSchema,
} from '../common/ids';
import {messageDurationSchema} from '../tools/messages';
import {epochMillisecondsSchema, messageTargetsSchema} from './overlayState';
import {plainObject} from '../common/payload';
import {nonNegativeInteger, percent} from '../common/primitives';
import {liveNonBlankTextSchema} from './liveLimits';

/**
 * What the audio layer plays: one media item, or a position in an audio
 * playlist.
 */
export const audioSourceSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('media'), mediaId: mediaIdSchema}),
    v.object({
      kind: v.literal('playlist'),
      playlistId: audioPlaylistIdSchema,
      position: nonNegativeInteger,
    }),
  ]),
);

/**
 * What the audio layer plays: one media item, or the track at `position` of an
 * audio playlist.
 */
export type AudioSource = ReadonlyKnown<
  v.InferOutput<typeof audioSourceSchema>
>;

/** M3 commands remain unsupported until their owning live slices register. */
export const liveActionOptions = [
  v.object({type: v.literal('theme.set'), themeId: themeIdSchema}),
  v.object({type: v.literal('themes.refresh')}),
  v.object({type: v.literal('item.stop')}),
  v.object({
    type: v.literal('stage.timer.set'),
    timerId: v.nullable(timerIdSchema),
  }),
  v.object({
    type: v.literal('stage.message.set'),
    text: v.nullable(liveNonBlankTextSchema),
  }),
  v.object({
    type: v.literal('prop.set'),
    propId: propIdSchema,
    on: v.boolean(),
  }),
  v.object({
    type: v.literal('message.send'),
    text: liveNonBlankTextSchema,
    targets: messageTargetsSchema,
    duration: messageDurationSchema,
  }),
  v.object({type: v.literal('timer.start'), timerId: timerIdSchema}),
  v.object({type: v.literal('timer.pause'), timerId: timerIdSchema}),
  v.object({type: v.literal('timer.reset'), timerId: timerIdSchema}),
  v.object({
    type: v.literal('audio.play'),
    source: v.exactOptional(audioSourceSchema),
  }),
  v.object({type: v.literal('audio.pause')}),
  v.object({
    type: v.literal('audio.next'),
    trackVersion: v.exactOptional(
      v.pipe(nonNegativeInteger, v.maxValue(Number.MAX_SAFE_INTEGER)),
    ),
  }),
  v.object({type: v.literal('audio.previous')}),
  v.object({type: v.literal('audio.fadeOut')}),
  v.object({
    type: v.literal('audio.fadeOut.complete'),
    trackVersion: v.pipe(
      nonNegativeInteger,
      v.maxValue(Number.MAX_SAFE_INTEGER),
    ),
    since: epochMillisecondsSchema,
  }),
  v.object({type: v.literal('audio.volume.set'), volume: percent}),
  v.object({type: v.literal('macro.run'), macroId: macroIdSchema}),
  v.object({type: v.literal('item.start'), itemId: serviceItemIdSchema}),
] as const;

/** A live action for a content layer, 테마, stage, audio, macro, or item. */
export type LiveAction = ReadonlyKnown<v.InferOutput<typeof liveActionSchema>>;

/** Accepts one of `liveActionOptions`. */
export const liveActionSchema = v.pipe(
  plainObject,
  v.variant('type', liveActionOptions),
);
