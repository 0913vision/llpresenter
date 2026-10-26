import {parseBibleTranslation} from '../../src/shared/schema/bibleTranslation';
import {
  BIBLE_CHAPTER_MAX_BYTES,
  BIBLE_HEADER_PREFIX_BYTES,
  parseBibleChapter,
  parseBibleChunkHeader,
} from '../../src/main/bible/chunkFormat';

/** Converts validated legacy JSON to a framed v2 container without editing text. */
export function encodeChunkedBible(input: Uint8Array, file: string): Buffer {
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(
    input,
  );
  const parsed = parseBibleTranslation(text, file);
  if (!parsed.ok) {
    throw new Error(`${parsed.error.field}: ${parsed.error.message}`);
  }
  if (parsed.value.sourceVersion !== 1) {
    throw new Error('The converter requires a .llbible v1 JSON source');
  }
  const blocks: Buffer[] = [];
  let offset = 0;
  const header = {
    ...parsed.value.data,
    schemaVersion: 2,
    books: parsed.value.data.books.map(book => ({
      ...book,
      chapters: book.chapters.map(verses => {
        const block = Buffer.from(`${JSON.stringify(verses)}\n`, 'utf8');
        if (block.length > BIBLE_CHAPTER_MAX_BYTES) {
          throw new Error('Bible chapter exceeds its byte limit');
        }
        const entry = {offset, bytes: block.length, verses: verses.length};
        parseBibleChapter(block, entry);
        blocks.push(block);
        offset += block.length;
        return entry;
      }),
    })),
  };
  const bytes = Buffer.from(JSON.stringify(header), 'utf8');
  parseBibleChunkHeader(bytes, offset, header.id);
  const prefix = Buffer.alloc(BIBLE_HEADER_PREFIX_BYTES);
  prefix.writeUInt32LE(bytes.length);
  return Buffer.concat([prefix, bytes, ...blocks]);
}
