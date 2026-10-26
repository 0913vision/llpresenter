export const BIBLE_CHAPTER_CACHE_LIMIT = 32;
export const BIBLE_CHAPTER_CACHE_MAX_BYTES = 8_388_608;

export interface CachedBibleChapter {
  readonly translation: string;
  readonly book: number;
  readonly chapter: number;
  readonly bytes: number;
  readonly verses: readonly string[];
}

function cacheKey(translation: string, book: number, chapter: number): string {
  return JSON.stringify([translation, book, chapter]);
}

/** A single LRU budget shared by all translations in one library session. */
export class BibleChapterCache {
  private readonly entries = new Map<string, CachedBibleChapter>();
  private bytes = 0;

  /** Refreshes recency on a hit. Only validated chapter text belongs here. */
  read(
    translation: string,
    book: number,
    chapter: number,
  ): readonly string[] | undefined {
    const key = cacheKey(translation, book, chapter);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.verses;
  }

  store(entry: CachedBibleChapter): void {
    const key = cacheKey(entry.translation, entry.book, entry.chapter);
    this.remove(key);
    this.entries.set(key, entry);
    this.bytes += entry.bytes;
    while (
      this.entries.size > BIBLE_CHAPTER_CACHE_LIMIT ||
      this.bytes > BIBLE_CHAPTER_CACHE_MAX_BYTES
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
  }

  removeTranslation(translation: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.translation === translation) this.remove(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
}
