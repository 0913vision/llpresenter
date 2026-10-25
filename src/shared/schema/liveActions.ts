import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {
  audioPlaylistIdSchema,
  lookIdSchema,
  macroIdSchema,
  mediaIdSchema,
  noticeSetIdSchema,
  propIdSchema,
  screenIdSchema,
  serviceItemIdSchema,
  stageLayoutIdSchema,
  timerIdSchema,
} from './ids';
import {messageDurationSchema} from './messages';
import {plainObject} from './payload';
import {nonBlankText, nonNegativeInteger, percent} from './primitives';

const MAX_MESSAGE_TARGETS = 200;

const audioSourceSchema = v.pipe(
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

/** M3 commands remain unsupported until their owning live slices register. */
export const liveActionOptions = [
  v.object({type: v.literal('look.set'), lookId: lookIdSchema}),
  v.object({
    type: v.literal('stage.layout.set'),
    screenId: v.exactOptional(screenIdSchema),
    layoutId: stageLayoutIdSchema,
  }),
  v.object({
    type: v.literal('stage.message.set'),
    text: v.nullable(nonBlankText),
  }),
  v.object({
    type: v.literal('prop.set'),
    propId: propIdSchema,
    on: v.boolean(),
  }),
  v.object({
    type: v.literal('notice.start'),
    noticeId: noticeSetIdSchema,
    position: v.exactOptional(nonNegativeInteger),
  }),
  v.object({type: v.literal('notice.pause')}),
  v.object({type: v.literal('notice.stop')}),
  v.object({
    type: v.literal('message.send'),
    text: nonBlankText,
    targets: v.union([
      v.literal('all'),
      v.pipe(
        v.array(screenIdSchema),
        v.minLength(1),
        v.maxLength(MAX_MESSAGE_TARGETS),
        v.check(
          targets => new Set(targets).size === targets.length,
          'Another target already has this screen id',
        ),
      ),
    ]),
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
  v.object({type: v.literal('audio.next')}),
  v.object({type: v.literal('audio.previous')}),
  v.object({type: v.literal('audio.fadeOut')}),
  v.object({type: v.literal('audio.volume.set'), volume: percent}),
  v.object({type: v.literal('macro.run'), macroId: macroIdSchema}),
  v.object({type: v.literal('item.start'), itemId: serviceItemIdSchema}),
] as const;

/**
 * Stage layout without a screen targets the stage screen, until the next Look.
 * A null stage message takes it down. Notice start without a position resumes
 * the active paused set, or starts a new set at zero. Audio play without a
 * source resumes paused audio; callers supply a playlist source otherwise.
 * Fade out uses the three-second operator action; volume is a live percentage.
 */
export type LiveAction = ReadonlyKnown<v.InferOutput<typeof liveActionSchema>>;

export const liveActionSchema = v.pipe(
  plainObject,
  v.variant('type', liveActionOptions),
);
