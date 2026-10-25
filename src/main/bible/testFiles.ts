import {parseBibleTranslation} from '@shared/schema/bibleTranslation';
import {BIBLE_BOOKS} from './books';

export function translationFile(ids: readonly number[] = [43]) {
  return {
    format: 'llbible',
    schemaVersion: 1,
    id: 'sample',
    name: 'Invented translation',
    shortName: 'Sample',
    language: 'ko',
    source: {
      title: 'Invented verses',
      publisher: 'Test fixture',
      url: 'https://example.invalid/invented',
      license: 'Invented for tests',
      retrieved: '2026-10-25',
    },
    books: ids.map(id => {
      const book = BIBLE_BOOKS.find(book => book.id === id);
      if (!book) throw new Error('Unknown fixture book id');
      return {
        id,
        chapters: Array.from({length: book.chapters}, (_, chapter) =>
          Array.from(
            {length: chapter === 2 ? 36 : 8},
            (_, verse) =>
              `Invented book ${id}, chapter ${chapter + 1}, verse ${verse + 1}`,
          ),
        ),
      };
    }),
  };
}

export function parsedTranslation(value: unknown = translationFile()) {
  const result = parseBibleTranslation(JSON.stringify(value), 'sample.llbible');
  if (!result.ok) throw new Error(`Invalid fixture: ${result.error.message}`);
  return result.value.data;
}

export const FULL_TRANSLATION_VERSES = 31_102;

export function fullTranslationText(): string {
  const chapterCount = BIBLE_BOOKS.reduce(
    (total, book) => total + book.chapters,
    0,
  );
  const versesPerChapter = Math.floor(FULL_TRANSLATION_VERSES / chapterCount);
  let remainingExtras = FULL_TRANSLATION_VERSES % chapterCount;
  return JSON.stringify({
    ...translationFile([]),
    books: BIBLE_BOOKS.map(book => ({
      id: book.id,
      chapters: Array.from({length: book.chapters}, (_, chapter) => {
        const count = versesPerChapter + (remainingExtras-- > 0 ? 1 : 0);
        return Array.from({length: count}, (_, verse) =>
          `Invented book ${book.id}, chapter ${chapter + 1}, verse ${verse + 1}: `.padEnd(
            145,
            'x',
          ),
        );
      }),
    })),
  });
}
