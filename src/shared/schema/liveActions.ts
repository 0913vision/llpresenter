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
import {messageTargetsSchema} from './overlayState';
import {plainObject} from './payload';
import {nonNegativeInteger, percent} from './primitives';
import {liveNonBlankTextSchema} from './liveLimits';

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
    type: v.literal('notice.start'),
    noticeId: noticeSetIdSchema,
    position: v.exactOptional(nonNegativeInteger),
  }),
  v.object({type: v.literal('notice.pause')}),
  v.object({type: v.literal('notice.stop')}),
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
  v.object({type: v.literal('audio.next')}),
  v.object({type: v.literal('audio.previous')}),
  v.object({type: v.literal('audio.fadeOut')}),
  v.object({type: v.literal('audio.volume.set'), volume: percent}),
  v.object({type: v.literal('macro.run'), macroId: macroIdSchema}),
  v.object({type: v.literal('item.start'), itemId: serviceItemIdSchema}),
] as const;

/** A live action for a content layer, Look, stage, audio, macro, or item. */
export type LiveAction = ReadonlyKnown<v.InferOutput<typeof liveActionSchema>>;

export const liveActionSchema = v.pipe(
  plainObject,
  v.variant('type', liveActionOptions),
);
