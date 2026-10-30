import {basename, extname, join} from 'node:path';
import type {Translation} from '@core/schema/bible';
import type {FileError} from '@core/schema/fileFormat';
import {BibleChapterCache} from './chapterCache';
import {
  readBibleChapter,
  readBibleChapterFile,
  type BibleChapterFile,
} from './chapterFile';

export interface BibleChapterLibraryOptions {
  readonly folder: string;
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

/** Owns header indexes and a bounded global chapter cache for one load. */
export class BibleChapterLibrary {
  private readonly files = new Map<string, BibleChapterFile>();
  private readonly cache = new BibleChapterCache();
  private closed = false;

  constructor(
    files: readonly BibleChapterFile[],
    private readonly onProblem: (problem: FileError) => void,
  ) {
    for (const file of files) this.files.set(file.header.id, file);
  }

  get translations() {
    return [...this.files.values()].map(file => file.header);
  }

  header(translation: string) {
    return this.files.get(translation)?.header;
  }

  async chapter(
    translation: string,
    book: number,
    chapter: number,
  ): Promise<readonly string[] | null> {
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

  clear(): void {
    this.closed = true;
    this.files.clear();
    this.cache.clear();
  }
}

/** Loads only installed headers and reports each broken file once per load. */
export async function loadBibleChapterLibrary({
  folder,
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
  return new BibleChapterLibrary(files, report);
}
