import * as v from 'valibot';
import {
  layerKinds,
  type ClearTarget,
  type MediaChoice,
  type MessageLayer,
  type SlideLayer,
} from './live';
import type {Result} from '@core/common/result';
import {screenIdSchema} from '../common/ids';
import {layerSchemas, mediaChoiceSchema} from './liveState';
import {liveActionOptions, type LiveAction} from './liveActions';
import {
  screenCommandOptions,
  type ScreenCommand,
} from '../screens/screenCommands';
import {messageExpirySchema, type MessageExpiry} from './overlayState';
import {overlayClearSchema, type OverlayClear} from './overlayClear';
import {clearFadeSchema, type ClearFade} from './clearFade';
import {checkPart} from '../common/fileFormat';
import {
  parsePayload,
  payloadObject,
  plainObject,
  type PayloadError,
} from '../common/payload';

/**
 * A request to change the live state. Windows never change the state
 * directly; they send commands, and the main process applies them in order.
 */
export type SingleLiveCommand =
  | LiveAction
  | ScreenCommand
  | MessageExpiry
  | OverlayClear
  | {readonly type: 'slide.show'; readonly slide: SlideLayer}
  /** The live slide was edited; what it shows changes, its output does not. */
  | {readonly type: 'slide.update'; readonly slide: SlideLayer}
  | {readonly type: 'media.show'; readonly media: MediaChoice}
  | {readonly type: 'media.properties.refresh'}
  | {readonly type: 'message.show'; readonly message: MessageLayer}
  | {
      readonly type: 'layer.clear';
      readonly target: ClearTarget;
      readonly transition?: ClearFade;
    }
  | {readonly type: 'layer.clear.toggle'; readonly target: ClearTarget}
  | {readonly type: 'clear.undo'}
  | {readonly type: 'item.restore'}
  | {readonly type: 'black.toggle'}
  | {
      readonly type: 'output.set';
      readonly screenId: string;
      readonly on: boolean;
    };

/** A bounded, flat transaction. Nested batches are not supported. */
export interface LiveBatch {
  readonly type: 'live.batch';
  readonly commands: readonly SingleLiveCommand[];
}

export type LiveCommand = SingleLiveCommand | LiveBatch;

export type LiveCommandType = LiveCommand['type'];

export const MAX_LIVE_BATCH_COMMANDS = 256;

const singleCommandOptions = [
  ...liveActionOptions,
  ...screenCommandOptions,
  messageExpirySchema,
  overlayClearSchema,
  v.object({type: v.literal('slide.show'), slide: layerSchemas.slide}),
  v.object({type: v.literal('slide.update'), slide: layerSchemas.slide}),
  v.object({type: v.literal('media.show'), media: mediaChoiceSchema}),
  v.object({type: v.literal('media.properties.refresh')}),
  v.object({type: v.literal('message.show'), message: layerSchemas.message}),
  v.object({
    type: v.literal('layer.clear'),
    target: v.picklist(['all', ...layerKinds]),
    transition: v.exactOptional(clearFadeSchema),
  }),
  v.object({
    type: v.literal('layer.clear.toggle'),
    target: v.picklist(['all', ...layerKinds]),
  }),
  v.object({type: v.literal('clear.undo')}),
  v.object({type: v.literal('item.restore')}),
  v.object({type: v.literal('black.toggle')}),
  v.object({
    type: v.literal('output.set'),
    screenId: screenIdSchema,
    on: v.boolean(),
  }),
] as const;

const singleCommandSchema = v.pipe(
  plainObject,
  v.variant('type', singleCommandOptions),
);

const batchEnvelopeSchema = payloadObject({
  type: v.literal('live.batch'),
  commands: v.pipe(v.array(v.unknown()), v.maxLength(MAX_LIVE_BATCH_COMMANDS)),
});

const liveCommandSchema = v.pipe(
  plainObject,
  v.variant('type', [
    ...singleCommandOptions,
    v.object({
      type: v.literal('live.batch'),
      commands: v.pipe(
        v.array(singleCommandSchema),
        v.maxLength(MAX_LIVE_BATCH_COMMANDS),
      ),
    }),
  ]),
);

/**
 * Checks a command that arrived over IPC. The error names the field that
 * failed, so the main process can log why it dropped the command. Unknown
 * envelope fields are dropped; screen configurations retain future fields.
 * Never throws.
 */
export function parseLiveCommand(
  value: unknown,
): Result<LiveCommand, PayloadError> {
  return checkPart(liveCommandSchema, value);
}

/** A normalized request plus the indexed errors of skipped batch children. */
export interface ParsedLiveCommandRequest {
  readonly command: LiveCommand;
  readonly rejected: readonly PayloadError[];
}

/**
 * Validates batch children independently, in order. Callers log every rejected
 * field before dispatching the normalized command. Envelope errors fail the
 * whole request. Single commands use the same strict parser as the type guard.
 */
export function parseLiveCommandRequest(
  value: unknown,
): Result<ParsedLiveCommandRequest, PayloadError> {
  const object = parsePayload(plainObject, value);
  if (!object.ok || object.value.type !== 'live.batch') {
    const parsed = parseLiveCommand(value);
    return parsed.ok
      ? {ok: true, value: {command: parsed.value, rejected: []}}
      : parsed;
  }
  const batch = parsePayload(batchEnvelopeSchema, value);
  if (!batch.ok) return batch;
  const commands: Array<v.InferOutput<typeof singleCommandSchema>> = [];
  const rejected: PayloadError[] = [];
  for (const [index, child] of batch.value.commands.entries()) {
    const parsed = checkPart(singleCommandSchema, child);
    if (parsed.ok) {
      commands.push(parsed.value);
    } else {
      const {field, message} = parsed.error;
      rejected.push({
        field: `commands.${index}${field === '' ? '' : `.${field}`}`,
        message,
      });
    }
  }
  return {ok: true, value: {command: {type: 'live.batch', commands}, rejected}};
}
