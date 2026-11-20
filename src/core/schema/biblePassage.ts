import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {translationIdSchema} from './ids';
import {jsonObject, jsonRecord, nonBlankText} from './primitives';
import {slideTransitionSchema} from './slideTransition';
import {bibleVerseCutsSchema, verseKeySchema} from './bibleCuts';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {LIVE_STATE_LIMITS} from './liveLimits';

/** Which slides of a passage show its reference. */
export const bibleReferenceSchema = v.picklist([
  'every',
  'first',
  'last',
  'none',
]);

const editedVerseSchema = v.pipe(
  v.array(
    jsonObject({
      source: v.pipe(nonBlankText, v.maxLength(BIBLE_LOOKUP_LIMITS.verseText)),
      text: v.exactOptional(
        v.pipe(
          v.string(),
          v.maxLength(LIVE_STATE_LIMITS.textCharacters),
          v.check(
            text => text.split('\n').length <= LIVE_STATE_LIMITS.slideLines,
            'Too many Bible slide lines',
          ),
        ),
      ),
    }),
  ),
  v.minLength(1),
  v.maxLength(LIVE_STATE_LIMITS.bibleItemSlides),
  v.check(
    parts =>
      parts.some(part => part.text !== undefined) &&
      parts.reduce((sum, part) => sum + part.source.length, 0) <=
        BIBLE_LOOKUP_LIMITS.verseText,
    'Expected an edited Bible verse within its size limit',
  ),
);

/** The original slide boundaries and replacement text of a passage's edited verses. */
export const bibleEditedVersesSchema = v.pipe(
  jsonRecord(verseKeySchema, editedVerseSchema),
  v.maxEntries(LIVE_STATE_LIMITS.bibleItemSlides),
  v.check(verses => {
    let parts = 0;
    let characters = 0;
    for (const verse of Object.values(verses)) {
      parts += verse.length;
      characters += verse.reduce(
        (sum, part) => sum + (part.text?.length ?? 0),
        0,
      );
    }
    return (
      parts <= LIVE_STATE_LIMITS.bibleItemSlides &&
      characters <= LIVE_STATE_LIMITS.bibleItemCharacters
    );
  }, 'Too much edited Bible slide text'),
);

export type BibleEditedVerse = ReadonlyKnown<
  v.InferOutput<typeof editedVerseSchema>
>;

export const biblePassageSchema = jsonObject({
  translation: translationIdSchema,
  ref: nonBlankText,
  split: v.string(),
  reference: bibleReferenceSchema,
  verseNumbers: v.boolean(),
  translationName: v.boolean(),
  transition: v.exactOptional(slideTransitionSchema),
  cuts: v.exactOptional(bibleVerseCutsSchema),
  editedVerses: v.exactOptional(bibleEditedVersesSchema),
});

/**
 * A Bible passage as a 예배 순서 item or a 빠른 실행 item holds it: the
 * translation, the normalized reference, and how to split and label it.
 */
export type BiblePassage = ReadonlyKnown<
  v.InferOutput<typeof biblePassageSchema>
>;
