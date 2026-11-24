import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {translationIdSchema} from '../common/ids';
import {jsonObject, nonBlankText} from '../common/primitives';
import {slideTransitionSchema} from '../slides/slideTransition';

/** Which verses, in which translation, and how their slides are made. */
export const biblePassageSchema = jsonObject({
  translation: translationIdSchema,
  ref: nonBlankText,
  verseNumbers: v.boolean(),
  translationName: v.boolean(),
  transition: v.exactOptional(slideTransitionSchema),
});

/**
 * The passage of a Bible or sermon item, or of a 빠른 실행 item, as a file stores
 * it.
 */
export type BiblePassage = ReadonlyKnown<
  v.InferOutput<typeof biblePassageSchema>
>;
