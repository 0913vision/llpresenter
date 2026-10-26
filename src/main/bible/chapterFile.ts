import {lstat, open} from 'node:fs/promises';
import {
  BIBLE_HEADER_MAX_BYTES,
  BIBLE_HEADER_PREFIX_BYTES,
  parseBibleChapter,
  parseBibleChunkHeader,
  type BibleChunkHeader,
} from './chunkFormat';

export interface BiblePositionedReader {
  read(options: {
    readonly buffer: Buffer;
    readonly offset: number;
    readonly length: number;
    readonly position: number;
  }): Promise<{readonly bytesRead: number}>;
}

/** Completes short positioned reads and rejects an early end of file. */
export async function readBibleBytes(
  handle: BiblePositionedReader,
  length: number,
  position: number,
): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  let received = 0;
  while (received < length) {
    const {bytesRead} = await handle.read({
      buffer,
      offset: received,
      length: length - received,
      position: position + received,
    });
    if (bytesRead === 0) throw new Error('Unexpected end of Bible file');
    received += bytesRead;
  }
  return buffer;
}

/** An index with no retained chapter text or open file handle. */
export interface BibleChapterFile {
  readonly file: string;
  readonly header: BibleChunkHeader;
  readonly dataStart: number;
}

/** Reads only the prefix, JSON header and stat; never reads chapter bytes. */
export async function readBibleChapterFile(
  file: string,
  installedId: string,
): Promise<BibleChapterFile> {
  if (!(await lstat(file)).isFile()) {
    throw new Error('Expected a regular translation file');
  }
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    const prefix = await readBibleBytes(handle, BIBLE_HEADER_PREFIX_BYTES, 0);
    const headerBytes = prefix.readUInt32LE();
    const dataStart = BIBLE_HEADER_PREFIX_BYTES + headerBytes;
    if (
      headerBytes === 0 ||
      headerBytes > BIBLE_HEADER_MAX_BYTES ||
      dataStart > stat.size
    ) {
      throw new Error('Invalid Bible header byte length');
    }
    const bytes = await readBibleBytes(
      handle,
      headerBytes,
      BIBLE_HEADER_PREFIX_BYTES,
    );
    const header = parseBibleChunkHeader(
      bytes,
      stat.size - dataStart,
      installedId,
    );
    return {file, header, dataStart};
  } finally {
    await handle.close();
  }
}

/** Reads exactly the requested chapter with positioned, partial-read-safe IO. */
export async function readBibleChapter(
  indexed: BibleChapterFile,
  bookId: number,
  chapter: number,
): Promise<readonly string[]> {
  const entry = indexed.header.books
    .find(book => book.id === bookId)
    ?.chapters.at(chapter - 1);
  if (!Number.isSafeInteger(chapter) || chapter < 1 || !entry) {
    throw new Error('Bible chapter is outside the translation index');
  }
  const handle = await open(indexed.file, 'r');
  try {
    const bytes = await readBibleBytes(
      handle,
      entry.bytes,
      indexed.dataStart + entry.offset,
    );
    return parseBibleChapter(bytes, entry);
  } finally {
    await handle.close();
  }
}
