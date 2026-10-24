import * as v from 'valibot';
import type {LiveCommand} from '../commands';
import {layerKinds} from '../live';
import type {Result} from '../result';
import {layerSchemas, mediaChoiceSchema} from './liveState';
import {parsePayload, type PayloadError} from './payload';

const liveCommandSchema = v.variant('type', [
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
]);

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
