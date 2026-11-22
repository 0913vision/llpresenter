import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {translationIdSchema} from './ids';
import {jsonObject, nonBlankText} from './primitives';
import {slideTransitionSchema} from './slideTransition';

/** Which verses, in which translation, and how their slides are made. */
export const biblePassageSchema = jsonObject({
  translation: translationIdSchema,
  ref: nonBlankText,
  verseNumbers: v.boolean(),
  translationName: v.boolean(),
  transition: v.exactOptional(slideTransitionSchema),
});

export type BiblePassage = ReadonlyKnown<
  v.InferOutput<typeof biblePassageSchema>
>;
