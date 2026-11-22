import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {BIBLE_CUTS_LIMITS, verseKeySchema} from './bibleCuts';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {slideIdSchema, translationIdSchema} from './ids';
import {
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonBlankText,
} from './primitives';
import {SONG_NAME_MAX_LENGTH} from './song';
import {slideLabelSchema} from './slideLabel';
import {slideTransitionSchema} from './slideTransition';

/** Which slides of a passage show its reference. */
export const bibleReferenceSchema = v.picklist([
  'every',
  'first',
  'last',
  'none',
]);

/** A slide of a verse: its own text, and its settings like any other slide's. */
export const bibleSlideSchema = jsonObject({
  id: slideIdSchema,
  text: v.pipe(v.string(), v.maxLength(BIBLE_LOOKUP_LIMITS.verseText)),
  /** A reference typed for this slide; the verse's own when absent. */
  reference: v.exactOptional(
    v.pipe(v.string(), v.maxLength(SONG_NAME_MAX_LENGTH)),
  ),
  label: v.exactOptional(slideLabelSchema),
  transition: v.exactOptional(slideTransitionSchema),
});

/** The slides of each verse, by book:chapter:verse. An empty list hides it. */
export const bibleSlidesSchema = v.pipe(
  jsonRecord(
    verseKeySchema,
    v.pipe(
      listWithUniqueIds(bibleSlideSchema),
      v.maxLength(BIBLE_CUTS_LIMITS.cuts + 1),
    ),
  ),
  v.maxEntries(10_000),
);

export const biblePassageSchema = jsonObject({
  translation: translationIdSchema,
  ref: nonBlankText,
  split: v.string(),
  reference: bibleReferenceSchema,
  verseNumbers: v.boolean(),
  translationName: v.boolean(),
  transition: v.exactOptional(slideTransitionSchema),
  slides: v.exactOptional(bibleSlidesSchema),
});

/**
 * A Bible passage as a 예배 순서 item or a 빠른 실행 item holds it: the
 * translation, the normalized reference, and the slides of its verses.
 */
export type BiblePassage = ReadonlyKnown<
  v.InferOutput<typeof biblePassageSchema>
>;
export type BibleSlide = ReadonlyKnown<v.InferOutput<typeof bibleSlideSchema>>;
export type BibleSlides = ReadonlyKnown<
  v.InferOutput<typeof bibleSlidesSchema>
>;
