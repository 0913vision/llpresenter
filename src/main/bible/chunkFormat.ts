import {
  parseBibleChunkHeader as parseHeader,
  type BibleChunkHeader,
} from '@core/schema/bibleChunks';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';

export {
  BIBLE_HEADER_MAX_BYTES,
  BIBLE_CHAPTER_MAX_BYTES,
  BIBLE_HEADER_PREFIX_BYTES,
  parseBibleChapter,
  type BibleChunkHeader,
} from '@core/schema/bibleChunks';

/** Adds canonical chapter-count checks to the shared container validation. */
export function parseBibleChunkHeader(
  bytes: Uint8Array,
  bodyBytes: number,
  installedId: string,
): BibleChunkHeader {
  const header = parseHeader(bytes, bodyBytes, installedId);
  for (const book of header.books) {
    const canonical = BIBLE_BOOKS.find(candidate => candidate.id === book.id);
    if (book.chapters.length !== canonical?.chapters) {
      throw new Error('Invalid Bible chapter count');
    }
  }
  return header;
}
