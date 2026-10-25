import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {
  mediaIdSchema,
  messageIdSchema,
  propIdSchema,
  screenIdSchema,
} from './ids';
import {parsePayload, payloadObject, type PayloadError} from './payload';
import {
  nonBlankText,
  nonNegativeInteger,
  nonNegativeNumber,
  positiveSeconds,
} from './primitives';
import {propContentSchema} from './props';
import type {Result} from '../result';

export const MAX_ACTIVE_MESSAGES = 200;
export const MAX_ACTIVE_PROPS = 64;
export const MAX_NOTICE_IMAGES = 512;
export const MAX_TARGET_SCREENS = 200;

export const epochMillisecondsSchema = v.pipe(
  nonNegativeNumber,
  v.maxValue(Number.MAX_SAFE_INTEGER),
);

export const overlayScreenIdsSchema = v.pipe(
  v.array(screenIdSchema),
  v.maxLength(MAX_TARGET_SCREENS),
  v.check(
    ids => new Set(ids).size === ids.length,
    'Another target already has this screen id',
  ),
);

export const messageTargetsSchema = v.union([
  v.literal('all'),
  v.pipe(overlayScreenIdsSchema, v.minLength(1)),
]);

export const activeMessageSchema = v.pipe(
  payloadObject({
    messageId: messageIdSchema,
    text: nonBlankText,
    targets: messageTargetsSchema,
    excludedTargets: overlayScreenIdsSchema,
    startedAt: epochMillisecondsSchema,
    expiresAt: v.nullable(epochMillisecondsSchema),
  }),
  v.forward(
    v.check(
      message =>
        message.expiresAt === null || message.expiresAt >= message.startedAt,
      'A message cannot expire before it starts',
    ),
    ['expiresAt'],
  ),
  v.forward(
    v.check(
      message =>
        message.targets === 'all' ||
        message.excludedTargets.every(id => message.targets.includes(id)),
      'Excluded screens must belong to the message targets',
    ),
    ['excludedTargets'],
  ),
);

export const activePropSchema = payloadObject({
  propId: propIdSchema,
  content: propContentSchema,
  targets: overlayScreenIdsSchema,
});

export const activeMessagesSchema = v.pipe(
  v.array(activeMessageSchema),
  v.maxLength(MAX_ACTIVE_MESSAGES),
  v.check(
    items => new Set(items.map(item => item.messageId)).size === items.length,
    'Another active message already has this id',
  ),
);
export const activePropsSchema = v.pipe(
  v.array(activePropSchema),
  v.maxLength(MAX_ACTIVE_PROPS),
  v.check(
    items => new Set(items.map(item => item.propId)).size === items.length,
    'Another active prop already has this id',
  ),
);

export const noticePlaybackSchema = v.pipe(
  payloadObject({
    media: v.pipe(
      v.array(mediaIdSchema),
      v.minLength(1),
      v.maxLength(MAX_NOTICE_IMAGES),
    ),
    position: nonNegativeInteger,
    interval: positiveSeconds,
    loop: v.boolean(),
    targets: v.pipe(overlayScreenIdsSchema, v.minLength(1)),
    startedAt: epochMillisecondsSchema,
    pausedAt: v.nullable(epochMillisecondsSchema),
  }),
  v.forward(
    v.check(
      playback => playback.position < playback.media.length,
      'The notice position is outside its images',
    ),
    ['position'],
  ),
  v.forward(
    v.check(
      playback =>
        playback.pausedAt === null || playback.pausedAt >= playback.startedAt,
      'A notice cannot pause before it starts',
    ),
    ['pausedAt'],
  ),
);

export const messageExpirySchema = v.object({
  type: v.literal('message.expire'),
  messageId: messageIdSchema,
  expiresAt: epochMillisecondsSchema,
});

/** One message's per-screen routing and main-clock lifetime. */
export type ActiveMessage = ReadonlyKnown<
  v.InferOutput<typeof activeMessageSchema>
>;
export type ActiveProp = ReadonlyKnown<v.InferOutput<typeof activePropSchema>>;
export type NoticePlayback = ReadonlyKnown<
  v.InferOutput<typeof noticePlaybackSchema>
>;
/** A deadline-bearing expiry request for one active message. */
export type MessageExpiry = ReadonlyKnown<
  v.InferOutput<typeof messageExpirySchema>
>;

export function parseActiveMessages(
  value: unknown,
): Result<readonly ActiveMessage[], PayloadError> {
  return parsePayload(activeMessagesSchema, value);
}

export function parseActiveProps(
  value: unknown,
): Result<readonly ActiveProp[], PayloadError> {
  return parsePayload(activePropsSchema, value);
}

export function parseNoticePlayback(
  value: unknown,
): Result<NoticePlayback, PayloadError> {
  return parsePayload(noticePlaybackSchema, value);
}
