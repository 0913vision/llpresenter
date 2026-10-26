import type {Result} from '@shared/result';
import {
  loadBibleChapterLibrary,
  type BibleChapterLibrary,
  type BibleChapterLibraryOptions,
} from './chapterLibrary';
import {
  resolvePassage,
  type ReferenceProblem,
  type ResolvedPassage,
} from './reference';

/** Resolves passages from an indexed catalog without loading whole files. */
export class BibleLibrary {
  constructor(private readonly catalog: BibleChapterLibrary) {}

  get translations() {
    return this.catalog.translations;
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
