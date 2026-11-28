import {join, resolve} from 'node:path';
import type {BibleChapterFile} from '@main/bible/chapterFile';
import {parseBibleChunkHeader} from '@main/bible/chunkFormat';
import {
  chunkedTranslationFile,
  translationFile,
} from '@fixtures/core/bible/testFiles';

type Translation = ReturnType<typeof translationFile>;

/** A translation file of the mock Bible folder, or one that can't be read. */
type TranslationEntry = Translation | 'broken';

const translations = new Map<string, TranslationEntry>();
const liveChapters = new Map<string, readonly string[]>();
let folders = 0;

function missing(file: string): Error {
  return Object.assign(
    new Error(`ENOENT: no such file or directory, open '${file}'`),
    {code: 'ENOENT'},
  );
}

/** Answers like a file read: what `read` gives, or a rejection with its error. */
async function settled<T>(read: () => T): Promise<T> {
  await Promise.resolve();
  return read();
}

function translationAt(file: string): TranslationEntry {
  const found = translations.get(file);
  if (found === undefined) throw missing(file);
  return found;
}

function liveFile(folder: string, book: number, chapter: number): string {
  return join(folder, 'live', `${book}-${chapter}.json`);
}

/**
 * The Bible folder above the file system: a test puts, breaks and removes its
 * `.llbible` files by path and reads the live chapters kept in it, while the
 * modules that own the real files read and write here. Mock both with
 * `vi.mock('@main/bible/chapterFile', async () => ({...(await import('@fixtures/main/bible/mockBibleFolder'))}))`
 * and the same for `@main/bible/liveChapterDisk`, so no Bible test above them
 * needs a real folder or leaves one.
 */
export const bibleFolder = {
  /** A new empty Bible folder; nothing is on disk. */
  create(): string {
    folders += 1;
    return resolve(`/mock-bible-${folders}`);
  },
  put(file: string, translation: Translation = translationFile()): void {
    translations.set(file, translation);
  },
  /** A file whose header or chapters no longer read, as a cut-off copy. */
  breakFile(file: string): void {
    translations.set(file, 'broken');
  },
  remove(file: string): void {
    translations.delete(file);
  },
  /** The verses kept for a chapter of the live source, if any. */
  liveChapter(
    folder: string,
    book: number,
    chapter: number,
  ): readonly string[] | undefined {
    return liveChapters.get(liveFile(folder, book, chapter));
  },
  removeLiveChapter(folder: string, book: number, chapter: number): void {
    liveChapters.delete(liveFile(folder, book, chapter));
  },
};

export function readBibleChapterFile(
  file: string,
  installedId: string,
): Promise<BibleChapterFile> {
  return settled(() => {
    const translation = translationAt(file);
    if (translation === 'broken') {
      throw new Error('Invalid Bible header byte length');
    }
    const {header, blocks} = chunkedTranslationFile(translation);
    const body = blocks.reduce((sum, block) => sum + block.length, 0);
    return {
      file,
      header: parseBibleChunkHeader(
        Buffer.from(JSON.stringify(header), 'utf8'),
        body,
        installedId,
      ),
      dataStart: 0,
    };
  });
}

export function readBibleChapter(
  indexed: BibleChapterFile,
  bookId: number,
  chapter: number,
): Promise<readonly string[]> {
  return settled(() => {
    const translation = translationAt(indexed.file);
    if (translation === 'broken') {
      throw new Error('Unexpected end of Bible file');
    }
    const verses = translation.books.find(book => book.id === bookId)?.chapters[
      chapter - 1
    ];
    if (!Number.isSafeInteger(chapter) || chapter < 1 || !verses) {
      throw new Error('Bible chapter is outside the translation index');
    }
    return verses;
  });
}

export function readLiveChapter(
  folder: string,
  book: number,
  chapter: number,
): Promise<readonly string[] | null> {
  return Promise.resolve(
    liveChapters.get(liveFile(folder, book, chapter)) ?? null,
  );
}

export function writeLiveChapter(
  folder: string,
  {
    book,
    chapter,
    verses,
  }: {
    readonly book: number;
    readonly chapter: number;
    readonly verses: readonly string[];
  },
): Promise<void> {
  liveChapters.set(liveFile(folder, book, chapter), verses);
  return Promise.resolve();
}
