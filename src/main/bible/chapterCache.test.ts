import {describe, expect, it} from 'vitest';
import {
  BIBLE_CHAPTER_CACHE_LIMIT,
  BIBLE_CHAPTER_CACHE_MAX_BYTES,
  BibleChapterCache,
} from './chapterCache';
import {BIBLE_CHAPTER_MAX_BYTES} from './chunkFormat';

function entry(chapter: number, translation = 'sample', bytes = 32) {
  return {
    translation,
    book: 19,
    chapter,
    bytes,
    verses: Object.freeze([`Invented sentence ${chapter}.`]),
  };
}

describe('Bible chapter cache', () => {
  it('shares the count budget across translations and refreshes hits', () => {
    const cache = new BibleChapterCache();
    for (let chapter = 1; chapter <= BIBLE_CHAPTER_CACHE_LIMIT; chapter++) {
      cache.store(entry(chapter, chapter % 2 ? 'first' : 'second'));
    }
    expect(cache.read('first', 19, 1)).toEqual(['Invented sentence 1.']);
    cache.store(entry(33, 'second'));
    expect(cache.read('second', 19, 2)).toBeUndefined();
    expect(cache.read('first', 19, 1)).toEqual(['Invented sentence 1.']);
    expect(cache.read('second', 19, 32)).toEqual(['Invented sentence 32.']);
    expect(cache.read('second', 19, 33)).toEqual(['Invented sentence 33.']);
  });

  it('evicts by indexed source-block bytes before reaching the count limit', () => {
    const cache = new BibleChapterCache();
    const capacity = BIBLE_CHAPTER_CACHE_MAX_BYTES / BIBLE_CHAPTER_MAX_BYTES;
    expect(capacity).toBeLessThan(BIBLE_CHAPTER_CACHE_LIMIT);
    for (let chapter = 1; chapter <= capacity; chapter++) {
      cache.store(entry(chapter, 'sample', BIBLE_CHAPTER_MAX_BYTES));
    }
    expect(cache.read('sample', 19, 1)).toBeDefined();
    cache.store(entry(capacity + 1, 'another', BIBLE_CHAPTER_MAX_BYTES));
    expect(cache.read('sample', 19, 2)).toBeUndefined();
    expect(cache.read('sample', 19, 1)).toBeDefined();
    expect(cache.read('another', 19, capacity + 1)).toBeDefined();
  });

  it('replaces entries without leaking their previous byte charge', () => {
    const cache = new BibleChapterCache();
    for (let iteration = 0; iteration < 20; iteration++) {
      cache.store(entry(1, 'sample', BIBLE_CHAPTER_MAX_BYTES));
    }
    const replacement = entry(1, 'sample', 1);
    cache.store(replacement);
    for (let chapter = 2; chapter <= 9; chapter++) {
      cache.store(entry(chapter, 'sample', BIBLE_CHAPTER_MAX_BYTES - 1));
    }
    expect(cache.read('sample', 19, 1)).toBe(replacement.verses);
    expect(cache.read('sample', 19, 9)).toBeDefined();
  });

  it('removes a broken translation without evicting unrelated chapters', () => {
    const cache = new BibleChapterCache();
    cache.store(entry(1, 'broken'));
    cache.store(entry(2, 'broken'));
    const good = entry(1, 'good');
    cache.store(good);
    cache.removeTranslation('broken');
    cache.removeTranslation('missing');
    expect(cache.read('broken', 19, 1)).toBeUndefined();
    expect(cache.read('broken', 19, 2)).toBeUndefined();
    expect(cache.read('good', 19, 1)).toBe(good.verses);
  });

  it('clears both entries and their byte budget', () => {
    const cache = new BibleChapterCache();
    cache.store(entry(1, 'old', BIBLE_CHAPTER_MAX_BYTES));
    cache.clear();
    expect(cache.read('old', 19, 1)).toBeUndefined();
    for (let chapter = 1; chapter <= 8; chapter++) {
      cache.store(entry(chapter, 'new', BIBLE_CHAPTER_MAX_BYTES));
    }
    expect(cache.read('new', 19, 1)).toBeDefined();
    expect(cache.read('new', 19, 8)).toBeDefined();
  });
});
