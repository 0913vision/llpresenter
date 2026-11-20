import * as v from 'valibot';
import {jsonRecord, nonBlankText} from './primitives';
import {LIVE_STATE_LIMITS, liveNonBlankTextSchema} from './liveLimits';
import type {ReadonlyKnown} from './fileFormat';

const key = v.pipe(nonBlankText, v.maxLength(320));

/** A missing binding uses the automatic text in the theme. */
export const slideTextOverridesSchema = v.pipe(
  jsonRecord(key, liveNonBlankTextSchema),
  v.maxEntries(128),
);

export const itemTextOverridesSchema = v.pipe(
  jsonRecord(key, slideTextOverridesSchema),
  v.maxEntries(LIVE_STATE_LIMITS.bibleItemSlides),
  v.check(
    slides =>
      Object.values(slides).reduce(
        (size, slots) =>
          size +
          Object.entries(slots).reduce(
            (length, [binding, text]) => length + binding.length + text.length,
            0,
          ),
        0,
      ) <= LIVE_STATE_LIMITS.bibleItemCharacters,
    'Too much slide text',
  ),
);

export type SlideTextOverrides = ReadonlyKnown<
  v.InferOutput<typeof slideTextOverridesSchema>
>;
export type ItemTextOverrides = ReadonlyKnown<
  v.InferOutput<typeof itemTextOverridesSchema>
>;
