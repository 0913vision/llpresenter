import {expect, it} from 'vitest';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {BIBLE_VERSE_COUNTS} from '@core/bible/bibleVerseCounts';

it('has a positive last verse for every canonical chapter', () => {
  expect(BIBLE_VERSE_COUNTS).toHaveLength(66);
  expect(
    BIBLE_VERSE_COUNTS.reduce((sum, chapters) => sum + chapters.length, 0),
  ).toBe(1189);
  for (const book of BIBLE_BOOKS) {
    const counts = BIBLE_VERSE_COUNTS[book.id - 1];
    expect(counts).toHaveLength(book.chapters);
    expect(
      counts?.every(count => Number.isSafeInteger(count) && count > 0),
    ).toBe(true);
  }
});
it('includes the expected final verses for John, Habakkuk and Psalm 119', () => {
  expect(BIBLE_VERSE_COUNTS[42]?.[2]).toBe(36);
  expect(BIBLE_VERSE_COUNTS[34]?.[2]).toBe(19);
  expect(BIBLE_VERSE_COUNTS[18]?.[118]).toBe(176);
});
