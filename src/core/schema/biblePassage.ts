import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {translationIdSchema} from './ids';
import {jsonObject, jsonRecord, nonBlankText} from './primitives';
import {slideTransitionSchema} from './slideTransition';
import {bibleVerseCutsSchema} from './bibleCuts';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {LIVE_STATE_LIMITS} from './liveLimits';

export const pinnedBibleVersesSchema = v.pipe(
  jsonRecord(
    v.pipe(nonBlankText, v.maxLength(256)),
    v.pipe(
      v.array(v.pipe(nonBlankText, v.maxLength(BIBLE_LOOKUP_LIMITS.verseText))),
      v.minLength(1),
      v.maxLength(LIVE_STATE_LIMITS.bibleItemSlides),
      v.check(
        parts => parts.join('').length <= BIBLE_LOOKUP_LIMITS.verseText,
        'Bible verse is too long',
      ),
    ),
  ),
  v.maxEntries(LIVE_STATE_LIMITS.bibleItemSlides),
  v.check(
    verses =>
      Object.values(verses).reduce(
        (sum, parts) => sum + parts.join('').length,
        0,
      ) <= LIVE_STATE_LIMITS.bibleItemCharacters,
    'Too much pinned Bible text',
  ),
);

/** Which slides of a passage show its reference. */
export const bibleReferenceSchema = v.picklist([
  'every',
  'first',
  'last',
  'none',
]);

export const biblePassageSchema = jsonObject({
  translation: translationIdSchema,
  ref: nonBlankText,
  split: v.string(),
  reference: bibleReferenceSchema,
  verseNumbers: v.boolean(),
  translationName: v.boolean(),
  transition: v.exactOptional(slideTransitionSchema),
  cuts: v.exactOptional(bibleVerseCutsSchema),
  pinnedVerses: v.exactOptional(pinnedBibleVersesSchema),
});

/**
 * A Bible passage as a 예배 순서 item or a 빠른 실행 item holds it: the
 * translation, the normalized reference, and how to split and label it.
 */
export type BiblePassage = ReadonlyKnown<
  v.InferOutput<typeof biblePassageSchema>
>;
