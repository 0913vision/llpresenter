import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {screenIdSchema} from '../common/ids';
import {plainObject} from '../common/payload';

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
