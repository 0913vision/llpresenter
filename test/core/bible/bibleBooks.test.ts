import {expect, it} from 'vitest';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';

it('contains all 66 books in canonical order with 1189 chapters', () => {
  expect(BIBLE_BOOKS.map(book => book.id)).toEqual(
    Array.from({length: 66}, (_, index) => index + 1),
  );
  expect(BIBLE_BOOKS.filter(book => book.testament === 'old')).toHaveLength(39);
  expect(BIBLE_BOOKS.filter(book => book.testament === 'new')).toHaveLength(27);
  expect(BIBLE_BOOKS.reduce((count, book) => count + book.chapters, 0)).toBe(
    1189,
  );
  expect(BIBLE_BOOKS[0]).toMatchObject({korean: '창세기', chapters: 50});
  expect(BIBLE_BOOKS[65]).toMatchObject({korean: '요한계시록', chapters: 22});
});
