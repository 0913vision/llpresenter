import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import {parseReference} from '@core/bible/reference';
import {BIBLE_LOOKUP_LIMITS} from '@core/schema/bibleLookup';
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

  complete(translation: string): boolean {
    const header = this.catalog.header(translation);
    return (
      header !== undefined &&
      BIBLE_BOOKS.every(book =>
        header.books.some(
          entry =>
            entry.id === book.id && entry.chapters.length === book.chapters,
        ),
      )
    );
  }

  hasTranslation(translation: string): boolean {
    return (
      translation === LIVE_BIBLE_ID ||
      this.catalog.header(translation) !== undefined
    );
  }

  /** Reads verse slots from the installed header, including omitted verses. */
  bounds(translation: string, name: string) {
    const matches = matchBooks(name);
    const book =
      exactBibleBook(name) ?? (matches.length === 1 ? matches[0] : undefined);
    if (translation === LIVE_BIBLE_ID && book) {
      return {
        bookId: book.id,
        chapterVerses: Array<number>(book.chapters).fill(
          BIBLE_LOOKUP_LIMITS.verses,
        ),
      };
    }
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
    cacheOnly = false,
  ): Promise<
    Result<
      ResolvedPassage & {readonly translationLabel: string},
      ReferenceProblem
    >
  > {
    if (translation === LIVE_BIBLE_ID) {
      const parsed = parseReference(input);
      if (!parsed.ok) return parsed;
      const {book, chapter, endChapter} = parsed.value;
      if (chapter > book.chapters || endChapter > book.chapters) {
        return {
          ok: false,
          error: {code: 'chapter', message: '이 역본에 없는 장입니다'},
        };
      }
      if (endChapter < chapter) {
        return {
          ok: false,
          error: {code: 'reversed', message: '끝 절이 시작 절보다 앞입니다'},
        };
      }
      const chapters = Array.from({length: book.chapters}, () => ({
        offset: 0,
        bytes: 1,
        verses: 1,
      }));
      for (let current = chapter; current <= endChapter; current++) {
        const verses = cacheOnly
          ? this.catalog.cachedChapter(translation, book.id, current)
          : await this.catalog.chapter(translation, book.id, current);
        if (!verses) {
          return {
            ok: false,
            error: {
              code: 'translation',
              message:
                '성경 본문을 받지 못했습니다. 인터넷 연결을 확인해 주십시오.',
            },
          };
        }
        chapters[current - 1] = {offset: 0, bytes: 1, verses: verses.length};
      }
      const result = await resolvePassage(
        {
          id: LIVE_BIBLE_ID,
          language: 'ko',
          books: [{id: book.id, chapters}],
          readChapter: async (id, current) =>
            cacheOnly
              ? this.catalog.cachedChapter(translation, id, current)
              : this.catalog.chapter(translation, id, current),
        },
        input,
      );
      return result.ok
        ? {ok: true, value: {...result.value, translationLabel: '개역개정'}}
        : result;
    }
    const header = this.catalog.header(translation);
    if (!header) {
      return {
        ok: false,
        error: {code: 'translation', message: '역본을 사용할 수 없습니다'},
      };
    }
    const result = await resolvePassage(
      {
        ...header,
        readChapter: (book, chapter) =>
          this.catalog.chapter(translation, book, chapter),
      },
      input,
    );
    return result.ok
      ? {
          ok: true,
          value: {
            ...result.value,
            translationLabel: header.shortName.slice(
              0,
              BIBLE_LOOKUP_LIMITS.input,
            ),
          },
        }
      : result;
  }

  clear(preserveLive = false): void {
    this.catalog.clear(preserveLive);
  }
}

/** Loads only installed headers; chapter reads happen during valid lookups. */
export async function loadBibleLibrary(
  options: BibleChapterLibraryOptions,
): Promise<BibleLibrary> {
  return new BibleLibrary(await loadBibleChapterLibrary(options));
}
