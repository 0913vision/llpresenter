import {expect, it} from 'vitest';
import {parseBibleTranslation} from '@shared/schema/bibleTranslation';
import {BIBLE_BOOKS} from './books';
import {FULL_TRANSLATION_VERSES, fullTranslationText} from './testFiles';

it('measures a full-size invented translation parse independently of file I/O', () => {
  const text = fullTranslationText();
  const bytes = Buffer.byteLength(text);
  expect(bytes).toBeGreaterThanOrEqual(4_000_000);
  expect(bytes).toBeLessThanOrEqual(5_000_000);
  const started = performance.now();
  const result = parseBibleTranslation(text, 'full.llbible');
  const elapsed = performance.now() - started;
  console.info(
    `Parse ${bytes} bytes, ${FULL_TRANSLATION_VERSES} verses: ${elapsed.toFixed(3)} ms`,
  );
  expect(elapsed).toBeLessThan(100);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  expect(result.value.data.books).toHaveLength(66);
  expect(result.value.data.books.map(book => book.chapters.length)).toEqual(
    BIBLE_BOOKS.map(book => book.chapters),
  );
  expect(
    result.value.data.books.reduce(
      (total, book) =>
        total +
        book.chapters.reduce((count, chapter) => count + chapter.length, 0),
      0,
    ),
  ).toBe(FULL_TRANSLATION_VERSES);
});
