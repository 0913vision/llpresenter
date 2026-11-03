import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {translationIdSchema} from './ids';
import {jsonObject, nonBlankText} from './primitives';

/** How a passage splits into slides: a verse each, two each, or as many as fit. */
export const bibleSplitSchema = v.picklist(['verse', 'two', 'fit']);

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
  split: bibleSplitSchema,
  reference: bibleReferenceSchema,
  verseNumbers: v.boolean(),
  translationName: v.boolean(),
});

/**
 * A Bible passage as a 예배 순서 item or a 퀵 실행 item holds it: the
 * translation, the normalized reference, and how to split and label it.
 */
export type BiblePassage = ReadonlyKnown<
  v.InferOutput<typeof biblePassageSchema>
>;
