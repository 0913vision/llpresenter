import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {screenIdSchema} from './ids';
import {plainObject} from './payload';
import {screenSchema} from './screens';

export const screenCommandOptions = [
  v.object({
    type: v.literal('screen.testPattern.set'),
    screenId: screenIdSchema,
    on: v.boolean(),
  }),
  v.object({type: v.literal('monitors.identify')}),
  v.object({type: v.literal('screen.settings.apply'), screen: screenSchema}),
] as const;

export const screenCommandSchema = v.pipe(
  plainObject,
  v.variant('type', screenCommandOptions),
);

/**
 * Monitor numbers show for three seconds on every physical monitor. Settings
 * apply a complete configuration to an existing screen's live output only;
 * persistence uses settings.edit. A test pattern never changes content layers.
 */
export type ScreenCommand = ReadonlyKnown<
  v.InferOutput<typeof screenCommandSchema>
>;
