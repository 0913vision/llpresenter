import * as v from 'valibot';
import {bibleTranslationMetadata} from './bibleTranslation';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {checkPart, type ReadonlyKnown} from './fileFormat';
import {jsonObject, nonNegativeInteger, positiveInteger} from './primitives';

export const BIBLE_HEADER_MAX_BYTES = 1_048_576;
export const BIBLE_CHAPTER_MAX_BYTES = 1_048_576;
export const BIBLE_HEADER_PREFIX_BYTES = 4;
const BIBLE_BOOK_CHAPTER_LIMIT = 150;

const safeNonNegativeInteger = v.pipe(
  nonNegativeInteger,
  v.maxValue(Number.MAX_SAFE_INTEGER),
);
const chapterSchema = jsonObject({
  offset: safeNonNegativeInteger,
  bytes: v.pipe(positiveInteger, v.maxValue(BIBLE_CHAPTER_MAX_BYTES)),
  verses: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.verses)),
});
const headerSchema = jsonObject({
  format: v.literal('llbible'),
  schemaVersion: v.literal(2),
  ...bibleTranslationMetadata,
  books: v.pipe(
    v.array(
      jsonObject({
        id: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.books)),
        chapters: v.pipe(
          v.array(chapterSchema),
          v.minLength(1),
          v.maxLength(BIBLE_BOOK_CHAPTER_LIMIT),
        ),
      }),
    ),
    v.maxLength(BIBLE_LOOKUP_LIMITS.books),
  ),
});

export type BibleChunkHeader = ReadonlyKnown<
  v.InferOutput<typeof headerSchema>
>;
export type BibleChapterOffset = ReadonlyKnown<
  v.InferOutput<typeof chapterSchema>
>;

function decodeJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(
    bytes,
  );
  return JSON.parse(text);
}

/** Validates metadata and every span using only the header and body size. */
export function parseBibleChunkHeader(
  bytes: Uint8Array,
  bodyBytes: number,
  installedId: string,
): BibleChunkHeader {
  if (bytes.length === 0 || bytes.length > BIBLE_HEADER_MAX_BYTES) {
    throw new Error('Bible header size is outside its limit');
  }
  const checked = checkPart(headerSchema, decodeJson(bytes));
  if (!checked.ok) throw new Error(checked.error.message);
  const header = checked.value;
  if (header.id !== installedId) {
    throw new Error('Translation id does not match its installed entry');
  }
  if (!Number.isSafeInteger(bodyBytes) || bodyBytes < 0) {
    throw new Error('Invalid Bible body size');
  }
  let end = 0;
  let previousId = 0;
  for (const book of header.books) {
    if (book.id <= previousId) {
      throw new Error('Invalid Bible book order');
    }
    previousId = book.id;
    for (const chapter of book.chapters) {
      const next = end + chapter.bytes;
      if (
        chapter.offset !== end ||
        !Number.isSafeInteger(next) ||
        next > bodyBytes
      ) {
        throw new Error('Invalid Bible chapter offset or byte span');
      }
      end = next;
    }
  }
  if (end !== bodyBytes) {
    throw new Error('Unexpected bytes after Bible chapters');
  }
  return header;
}

/** Checks a complete block before any text enters the lookup or cache. */
export function parseBibleChapter(
  bytes: Uint8Array,
  entry: BibleChapterOffset,
): readonly string[] {
  if (bytes.length !== entry.bytes || bytes.at(-1) !== 10) {
    throw new Error('Bible chapter must have its indexed size and final LF');
  }
  const verses = v.parse(
    v.pipe(
      v.array(
        v.pipe(
          v.string(),
          v.maxLength(BIBLE_LOOKUP_LIMITS.verseText),
          v.check(
            text => text === text.trim(),
            'Verse text must already be trimmed',
          ),
        ),
      ),
      v.length(entry.verses),
    ),
    decodeJson(bytes.subarray(0, -1)),
  );
  return Object.freeze(verses);
}
