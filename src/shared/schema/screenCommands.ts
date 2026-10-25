import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {screenIdSchema} from './ids';
import {plainObject} from './payload';

export const screenCommandOptions = [
  v.object({
    type: v.literal('screen.testPattern.set'),
    screenId: screenIdSchema,
    on: v.boolean(),
  }),
  v.object({type: v.literal('monitors.identify')}),
  v.object({
    type: v.literal('screen.settings.apply'),
    screenId: screenIdSchema,
  }),
] as const;

export const screenCommandSchema = v.pipe(
  plainObject,
  v.variant('type', screenCommandOptions),
);

/** A live screen diagnostic or configuration command. */
export type ScreenCommand = ReadonlyKnown<
  v.InferOutput<typeof screenCommandSchema>
>;
