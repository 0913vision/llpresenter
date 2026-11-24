import * as v from 'valibot';
import {messageIdSchema, propIdSchema} from '../common/ids';
import {plainObject} from '../common/payload';
import type {ReadonlyKnown} from '../common/fileFormat';
import {clearFadeSchema} from './clearFade';

export const overlayClearSchema = v.object({
  type: v.literal('overlay.clear'),
  transition: v.exactOptional(clearFadeSchema),
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
