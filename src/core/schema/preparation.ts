import * as v from 'valibot';
import {parsePayload, payloadObject} from './payload';

const MAX_PARTS = 100_000;

const count = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(MAX_PARTS),
);

const preparationSchema = v.pipe(
  payloadObject({done: count, total: count}),
  v.check(({done, total}) => done <= total, 'More is done than there is'),
);

/** How many parts of a window are prepared. */
export type Preparation = Readonly<v.InferOutput<typeof preparationSchema>>;

export function parsePreparation(value: unknown) {
  return parsePayload(preparationSchema, value);
}
