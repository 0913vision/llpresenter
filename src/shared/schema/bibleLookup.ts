import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {translationIdSchema} from './ids';
import {parsePayload, payloadObject, plainObject} from './payload';
import {nonBlankText, positiveInteger} from './primitives';

export const BIBLE_LOOKUP_LIMITS = {
  input: 256,
  translationId: 256,
  books: 66,
  suggestions: 8,
  verses: 40_000,
  verseText: 20_000,
  pending: 8,
} as const;

const referenceText = v.pipe(
  v.string(),
  v.maxLength(BIBLE_LOOKUP_LIMITS.input),
);
const translationId = v.pipe(
  translationIdSchema,
  v.maxLength(BIBLE_LOOKUP_LIMITS.translationId),
);
const requestSchema = payloadObject({
  translation: translationId,
  input: referenceText,
});
const passageSchema = payloadObject({
  translation: translationId,
  ref: referenceText,
  displayRef: referenceText,
  verses: v.pipe(
    v.array(
      payloadObject({
        chapter: positiveInteger,
        verse: positiveInteger,
        text: v.pipe(v.string(), v.maxLength(BIBLE_LOOKUP_LIMITS.verseText)),
      }),
    ),
    v.minLength(1),
    v.maxLength(BIBLE_LOOKUP_LIMITS.verses),
  ),
});
const problemSchema = payloadObject({
  code: v.picklist([
    'syntax',
    'unknownBook',
    'ambiguousBook',
    'missingBook',
    'chapter',
    'verse',
    'reversed',
    'omitted',
    'translation',
  ]),
  message: referenceText,
});
const replySchema = payloadObject({
  input: referenceText,
  translation: translationId,
  suggestions: v.pipe(
    v.array(
      payloadObject({
        bookId: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.books)),
        name: referenceText,
        input: referenceText,
        resolved: v.exactOptional(
          payloadObject({
            ref: v.pipe(nonBlankText, v.maxLength(BIBLE_LOOKUP_LIMITS.input)),
            verseCount: v.pipe(
              positiveInteger,
              v.maxValue(BIBLE_LOOKUP_LIMITS.verses),
            ),
          }),
        ),
      }),
    ),
    v.maxLength(BIBLE_LOOKUP_LIMITS.suggestions),
  ),
  result: v.pipe(
    plainObject,
    v.variant('ok', [
      v.object({ok: v.literal(true), value: passageSchema}),
      v.object({ok: v.literal(false), error: problemSchema}),
    ]),
  ),
});

export type BibleLookupRequest = Readonly<v.InferOutput<typeof requestSchema>>;
export type BibleLookupReply = ReadonlyKnown<v.InferOutput<typeof replySchema>>;
export type BibleLookupPassage = ReadonlyKnown<
  v.InferOutput<typeof passageSchema>
>;

export function parseBibleLookupRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

/** Rejects replies belonging to another input or translation. */
export function parseBibleLookupReply(
  request: BibleLookupRequest,
  value: unknown,
) {
  const parsed = parsePayload(replySchema, value);
  if (!parsed.ok) return parsed;
  const reply = parsed.value;
  if (
    reply.input !== request.input ||
    reply.translation !== request.translation ||
    (reply.result.ok && reply.result.value.translation !== request.translation)
  ) {
    return {
      ok: false,
      error: {field: 'translation', message: 'The reply names another lookup'},
    } as const;
  }
  return parsed;
}
