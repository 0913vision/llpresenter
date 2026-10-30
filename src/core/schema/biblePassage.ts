import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {translationIdSchema} from './ids';
import {jsonObject, nonBlankText} from './primitives';

export const biblePassageSchema = jsonObject({
  translation: translationIdSchema,
  ref: nonBlankText,
  split: v.picklist(['verse', 'two', 'fit']),
  reference: v.picklist(['every', 'first', 'none']),
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
