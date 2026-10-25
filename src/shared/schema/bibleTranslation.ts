import * as v from 'valibot';
import type {Result} from '../result';
import {
  parseFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {translationIdSchema} from './ids';
import {isLanguageTag} from './languageTag';
import {jsonObject, nonBlankText, positiveInteger} from './primitives';

const LAST_BOOK_ID = 66;
const retrievedDate = v.pipe(
  v.string(),
  v.isoDate(),
  v.check(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Expected a date that exists in the calendar'),
);

const bookSchema = jsonObject({
  id: v.pipe(positiveInteger, v.maxValue(LAST_BOOK_ID)),
  chapters: v.array(v.pipe(v.array(v.string()), v.minLength(1))),
});

const bibleTranslationSchema = jsonObject({
  format: v.literal('llbible'),
  schemaVersion: positiveInteger,
  id: v.pipe(
    translationIdSchema,
    v.check(
      id => id === id.toLowerCase(),
      'Expected a lowercase translation id',
    ),
  ),
  name: nonBlankText,
  shortName: nonBlankText,
  language: v.pipe(
    v.string(),
    v.check(isLanguageTag, 'Expected a BCP 47 language tag'),
  ),
  source: jsonObject({
    title: nonBlankText,
    publisher: nonBlankText,
    url: v.pipe(v.string(), v.url()),
    license: nonBlankText,
    retrieved: retrievedDate,
  }),
  books: v.pipe(
    v.array(bookSchema),
    v.maxLength(LAST_BOOK_ID),
    v.checkItems(
      (book, index, books) =>
        index === 0 || (books[index - 1]?.id ?? 0) < book.id,
      'Book ids must be in strictly increasing order',
    ),
  ),
});

const bibleTranslationFormat: FileFormat<typeof bibleTranslationSchema> = {
  format: 'llbible',
  schema: bibleTranslationSchema,
  migrations: [],
};

/** One installed `.llbible` translation file. */
export type BibleTranslationFile = ReadonlyKnown<
  v.InferOutput<typeof bibleTranslationSchema>
>;

export function parseBibleTranslation(
  text: string,
  file: string,
): Result<LoadedFile<BibleTranslationFile>, FileError> {
  return parseFile(bibleTranslationFormat, text, file);
}
