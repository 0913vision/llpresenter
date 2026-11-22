import * as v from 'valibot';
import {LIVE_STATE_LIMITS, liveTextSchema} from './liveLimits';
import {jsonRecord, nonBlankText} from './primitives';
import type {ReadonlyKnown} from './fileFormat';

const boxName = v.pipe(nonBlankText, v.maxLength(160));
const slideKey = v.pipe(nonBlankText, v.maxLength(320));

/** What a theme's own text boxes show on one slide, by the box's name. */
export const slideTextsSchema = v.pipe(
  jsonRecord(boxName, liveTextSchema),
  v.maxEntries(64),
);

/** The same for the slides of an item, by each slide's key in the item. */
export const itemTextsSchema = v.pipe(
  jsonRecord(slideKey, slideTextsSchema),
  v.maxEntries(LIVE_STATE_LIMITS.bibleItemSlides),
);

export type SlideTexts = ReadonlyKnown<v.InferOutput<typeof slideTextsSchema>>;
export type ItemTexts = ReadonlyKnown<v.InferOutput<typeof itemTextsSchema>>;
