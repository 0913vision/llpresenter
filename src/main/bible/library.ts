import type {Result} from '@core/common/result';
import {exactBibleBook, matchBooks} from '@core/bible/bibleMatching';
import {
  loadBibleChapterLibrary,
  type BibleChapterLibrary,
  type BibleChapterLibraryOptions,
} from './chapterLibrary';
import {
  resolvePassage,
  type ReferenceProblem,
  type ResolvedPassage,
} from '@core/bible/reference';

/** Resolves passages from an indexed catalog without loading whole files. */
export class BibleLibrary {
  constructor(private readonly catalog: BibleChapterLibrary) {}

  get translations() {
    return this.catalog.translations;
  }

  /** Reads verse slots from the installed header, including omitted verses. */
  bounds(translation: string, name: string) {
    const matches = matchBooks(name);
    const book =
      exactBibleBook(name) ?? (matches.length === 1 ? matches[0] : undefined);
    const indexed = this.catalog
      .header(translation)
      ?.books.find(entry => entry.id === book?.id);
    return indexed
      ? {
          bookId: indexed.id,
          chapterVerses: indexed.chapters.map(chapter => chapter.verses),
        }
      : undefined;
  }

  async resolve(
    translation: string,
    input: string,
  ): Promise<Result<ResolvedPassage, ReferenceProblem>> {
    const header = this.catalog.header(translation);
    if (!header) {
      return {
        ok: false,
        error: {code: 'translation', message: '사용할 수 없는 역본입니다'},
      };
    }
    return resolvePassage(
      {
        ...header,
        readChapter: (book, chapter) =>
          this.catalog.chapter(translation, book, chapter),
      },
      input,
    );
  }

  clear(): void {
    this.catalog.clear();
  }
}

/** Loads only installed headers; chapter reads happen during valid lookups. */
export async function loadBibleLibrary(
  options: BibleChapterLibraryOptions,
): Promise<BibleLibrary> {
  return new BibleLibrary(await loadBibleChapterLibrary(options));
}
