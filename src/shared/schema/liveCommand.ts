import * as v from 'valibot';
import type {LiveCommand} from '../commands';
import {layerKinds} from '../live';
import type {Result} from '../result';
import {layerSchemas, mediaChoiceSchema} from './liveState';
import {liveActionOptions} from './liveActions';
import {
  parsePayload,
  payloadObject,
  plainObject,
  type PayloadError,
} from './payload';

export const MAX_LIVE_BATCH_COMMANDS = 256;

const singleCommandOptions = [
  ...liveActionOptions,
  v.object({type: v.literal('slide.show'), slide: layerSchemas.slide}),
  v.object({type: v.literal('media.show'), media: mediaChoiceSchema}),
  v.object({type: v.literal('message.show'), message: layerSchemas.message}),
  v.object({
    type: v.literal('layer.clear'),
    target: v.picklist(['all', ...layerKinds]),
  }),
  v.object({type: v.literal('clear.undo')}),
  v.object({
    type: v.literal('output.set'),
    screenId: v.pipe(v.string(), v.nonEmpty()),
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
 * fields are dropped. Never throws.
 */
export function parseLiveCommand(
  value: unknown,
): Result<LiveCommand, PayloadError> {
  return parsePayload(liveCommandSchema, value);
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
    const parsed = parsePayload(singleCommandSchema, child);
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
