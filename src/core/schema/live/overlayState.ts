import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {messageIdSchema, propIdSchema, screenIdSchema} from '../common/ids';
import {
  parsePayload,
  payloadObject,
  type PayloadError,
} from '../common/payload';
import {nonNegativeNumber} from '../common/primitives';
import {propContentSchema} from '../tools/props';
import type {Result} from '@core/common/result';
import {LIVE_STATE_LIMITS, liveNonBlankTextSchema} from './liveLimits';

/** The most messages on output at once. */
export const MAX_ACTIVE_MESSAGES = 200;
/** The most props on output at once. */
export const MAX_ACTIVE_PROPS = 64;
/** The most screens one message or prop can name. */
export const MAX_TARGET_SCREENS = 200;

/**
 * A time in milliseconds since the epoch on the main process clock; never
 * negative.
 */
export const epochMillisecondsSchema = v.pipe(
  nonNegativeNumber,
  v.maxValue(Number.MAX_SAFE_INTEGER),
);

/** A list of screen ids without repeats, at most `MAX_TARGET_SCREENS`. */
export const overlayScreenIdsSchema = v.pipe(
  v.array(screenIdSchema),
  v.maxLength(MAX_TARGET_SCREENS),
  v.check(
    ids => new Set(ids).size === ids.length,
    'Another target already has this screen id',
  ),
);

/** The screens a message goes to: `all`, or one or more screen ids. */
export const messageTargetsSchema = v.union([
  v.literal('all'),
  v.pipe(overlayScreenIdsSchema, v.minLength(1)),
]);

/**
 * A message on output: its id and text, its target screens, the screens left
 * out of them, when it started, and when it expires, null for never. It cannot
 * expire before it starts, and the screens left out must be among its targets.
 */
export const activeMessageSchema = v.pipe(
  payloadObject({
    messageId: messageIdSchema,
    text: liveNonBlankTextSchema,
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

/** A prop on output: its id, its content, and its target screens. */
export const activePropSchema = payloadObject({
  propId: propIdSchema,
  content: v.pipe(
    propContentSchema,
    v.check(
      content =>
        content.kind !== 'text' ||
        content.text.length <= LIVE_STATE_LIMITS.textCharacters,
      'Live prop text is too long',
    ),
  ),
  targets: overlayScreenIdsSchema,
});

/**
 * The messages on output, at most `MAX_ACTIVE_MESSAGES`, each message id once.
 */
export const activeMessagesSchema = v.pipe(
  v.array(activeMessageSchema),
  v.maxLength(MAX_ACTIVE_MESSAGES),
  v.check(
    items => new Set(items.map(item => item.messageId)).size === items.length,
    'Another active message already has this id',
  ),
);
/** The props on output, at most `MAX_ACTIVE_PROPS`, each prop id once. */
export const activePropsSchema = v.pipe(
  v.array(activePropSchema),
  v.maxLength(MAX_ACTIVE_PROPS),
  v.check(
    items => new Set(items.map(item => item.propId)).size === items.length,
    'Another active prop already has this id',
  ),
);

/** A request that a message ends at a time on the main clock. */
export const messageExpirySchema = v.object({
  type: v.literal('message.expire'),
  messageId: messageIdSchema,
  expiresAt: epochMillisecondsSchema,
});

/** One message's per-screen routing and main-clock lifetime. */
export type ActiveMessage = ReadonlyKnown<
  v.InferOutput<typeof activeMessageSchema>
>;
/** One prop on output with its content and target screens. */
export type ActiveProp = ReadonlyKnown<v.InferOutput<typeof activePropSchema>>;
/** A deadline-bearing expiry request for one active message. */
export type MessageExpiry = ReadonlyKnown<
  v.InferOutput<typeof messageExpirySchema>
>;

/** Checks the messages on output that arrived over IPC. */
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
