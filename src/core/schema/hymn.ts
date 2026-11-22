import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {jsonObject, positiveInteger} from './primitives';

/** How many hymns each hymnal has. */
export const HYMN_COUNTS = {new: 645, unified: 558} as const;

export type Hymnal = keyof typeof HYMN_COUNTS;

/** One hymn, by its number in its hymnal. */
export const hymnSchema = v.pipe(
  jsonObject({
    hymnal: v.picklist(['new', 'unified']),
    number: positiveInteger,
  }),
  v.check(
    ({hymnal, number}) => number <= HYMN_COUNTS[hymnal],
    'The hymnal has no hymn of this number',
  ),
);

export type Hymn = ReadonlyKnown<v.InferOutput<typeof hymnSchema>>;
