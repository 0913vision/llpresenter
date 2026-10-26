import * as v from 'valibot';
import {messageIdSchema, propIdSchema} from './ids';
import {plainObject} from './payload';
import type {ReadonlyKnown} from './fileFormat';

export const overlayClearSchema = v.object({
  type: v.literal('overlay.clear'),
  target: v.pipe(
    plainObject,
    v.variant('kind', [
      v.object({kind: v.literal('message'), messageId: messageIdSchema}),
      v.object({kind: v.literal('prop'), propId: propIdSchema}),
      v.object({kind: v.literal('stage-message')}),
    ]),
  ),
});

export type OverlayClear = ReadonlyKnown<
  v.InferOutput<typeof overlayClearSchema>
>;
