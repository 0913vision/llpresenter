import {LIVE_BIBLE_ID} from '@core/bible';
import {fetchLiveChapter} from './liveChapter';
import {readLiveChapter, writeLiveChapter} from './liveChapterDisk';
import {basename, extname, join} from 'node:path';
import type {Translation} from '@core/schema/bible/bible';
import type {FileError} from '@core/schema/common/fileFormat';
import {BibleChapterCache} from './chapterCache';
import {
  readBibleChapter,
  readBibleChapterFile,
  type BibleChapterFile,
} from './chapterFile';

export interface BibleChapterLibraryOptions {
  readonly folder: string;
  readonly cache?: BibleChapterCache;
  readonly translations: readonly Translation[];
  readonly onProblem: (problem: FileError) => void;
}

function fileProblem(file: string, error: unknown): FileError {
  return {
    kind: 'read',
    file,
    field: '',
    message: error instanceof Error ? error.message : String(error),
  };
}

/** Owns translation indexes and the in-memory chapter cache. */
export class BibleChapterLibrary {
  private readonly files = new Map<string, BibleChapterFile>();
  private closed = false;
  private readonly cache: BibleChapterCache;
  private readonly folder: string | undefined;

  constructor(
    files: readonly BibleChapterFile[],
    private readonly onProblem: (problem: FileError) => void,
    options: {
      readonly cache?: BibleChapterCache | undefined;
      readonly folder?: string | undefined;
    } = {},
  ) {
    this.cache = options.cache ?? new BibleChapterCache();
    this.folder = options.folder;
    for (const file of files) this.files.set(file.header.id, file);
  }

  get translations() {
    return [...this.files.values()].map(file => file.header);
  }

  header(translation: string) {
    return this.files.get(translation)?.header;
  }

  cachedChapter(
    translation: string,
    book: number,
    chapter: number,
  ): readonly string[] | null {
    return this.closed
      ? null
      : (this.cache.read(translation, book, chapter) ?? null);
  }

  /** Reads session memory and then the validated on-disk live cache only. */
  async cachedLiveChapter(
    book: number,
    chapter: number,
  ): Promise<readonly string[] | null> {
    const cached = this.cachedChapter(LIVE_BIBLE_ID, book, chapter);
    if (cached !== null || this.closed || this.folder === undefined) {
      return cached;
    }
    const verses = await readLiveChapter(this.folder, book, chapter);
    if (verses === null || this.isClosed()) return null;
    this.cache.store({
      translation: LIVE_BIBLE_ID,
      book,
      chapter,
      bytes: Buffer.byteLength(JSON.stringify(verses)),
      verses,
    });
    return verses;
  }

  async chapter(
    translation: string,
    book: number,
    chapter: number,
  ): Promise<readonly string[] | null> {
    if (translation === LIVE_BIBLE_ID) {
      if (this.closed) return null;
      const cached = await this.cachedLiveChapter(book, chapter);
      if (cached) return cached;
      const verses = await fetchLiveChapter(book, chapter);
      if (!verses || this.isClosed()) return null;
      this.cache.store({
        translation,
        book,
        chapter,
        bytes: Buffer.byteLength(JSON.stringify(verses)),
        verses,
      });
      if (this.folder !== undefined) {
        await writeLiveChapter(this.folder, {book, chapter, verses});
      }
      return this.isClosed() ? null : verses;
    }
    const indexed = this.files.get(translation);
    const entry = indexed?.header.books
      .find(candidate => candidate.id === book)
      ?.chapters.at(chapter - 1);
    if (!indexed || !entry || !Number.isSafeInteger(chapter) || chapter < 1) {
      return null;
    }
    const cached = this.cache.read(translation, book, chapter);
    if (cached) return cached;
    try {
      const verses = await readBibleChapter(indexed, book, chapter);
      if (this.closed || this.files.get(translation) !== indexed) return null;
      this.cache.store({
        translation,
        book,
        chapter,
        bytes: entry.bytes,
        verses,
      });
      return verses;
    } catch (error: unknown) {
      if (!this.closed && this.files.get(translation) === indexed) {
        this.files.delete(translation);
        this.cache.removeTranslation(translation);
        this.onProblem(fileProblem(indexed.file, error));
      }
      return null;
    }
  }

  private isClosed(): boolean {
    return this.closed;
  }

  clear(preserveLive = false): void {
    this.closed = true;
    this.files.clear();
    if (preserveLive) this.cache.clearFiles();
    else this.cache.clear();
  }
}

/** Loads only installed headers and reports each broken file once per load. */
export async function loadBibleChapterLibrary({
  folder,
  cache,
  translations,
  onProblem,
}: BibleChapterLibraryOptions): Promise<BibleChapterLibrary> {
  const files: BibleChapterFile[] = [];
  const ids = new Set<string>();
  const warned = new Set<string>();
  const report = (problem: FileError) => {
    if (warned.has(problem.file)) return;
    warned.add(problem.file);
    onProblem(problem);
  };
  for (const installed of translations) {
    const file = join(folder, installed.file);
    try {
      if (ids.has(installed.id)) {
        throw new Error('Duplicate installed translation id');
      }
      ids.add(installed.id);
      if (
        basename(installed.file) !== installed.file ||
        /[\\/:]/u.test(installed.file) ||
        extname(installed.file).toLowerCase() !== '.llbible'
      ) {
        throw new Error('Expected a bare .llbible file name');
      }
      files.push(await readBibleChapterFile(file, installed.id));
    } catch (error: unknown) {
      report(fileProblem(file, error));
    }
  }
  return new BibleChapterLibrary(files, report, {cache, folder});
}
