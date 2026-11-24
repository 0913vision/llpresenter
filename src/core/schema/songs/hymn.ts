import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {jsonObject, positiveInteger} from '../common/primitives';

/** How many hymns each hymnal has. */
export const HYMN_COUNTS = {new: 645, unified: 558} as const;

/** The two hymnals a hymn can come from: `new` (새찬송가) or `unified` (통일찬송가). */
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

/** The hymn a title slide is the title of: its hymnal and its number in it. */
export type Hymn = ReadonlyKnown<v.InferOutput<typeof hymnSchema>>;
