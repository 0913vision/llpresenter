import {lstat} from 'node:fs/promises';
import {basename, extname, join} from 'node:path';
import {setImmediate} from 'node:timers/promises';
import type {Result} from '@shared/result';
import type {Translation} from '@shared/schema/bible';
import {
  parseBibleTranslation,
  type BibleTranslationFile,
} from '@shared/schema/bibleTranslation';
import type {FileError} from '@shared/schema/fileFormat';
import {loadFile} from '../store/readFiles';
import {BIBLE_BOOKS} from '@shared/bibleBooks';
import {
  resolvePassage,
  type ReferenceProblem,
  type ResolvedPassage,
} from './reference';

export interface BibleLibraryOptions {
  readonly folder: string;
  readonly translations: readonly Translation[];
  readonly onProblem: (problem: FileError) => void;
}

/** Owns loaded text only; lookups never read disk and clear releases the text. */
export class BibleLibrary {
  private readonly files = new Map<string, BibleTranslationFile>();

  constructor(translations: readonly BibleTranslationFile[]) {
    for (const translation of translations) {
      this.files.set(translation.id, translation);
    }
  }

  get translations(): readonly BibleTranslationFile[] {
    return [...this.files.values()];
  }

  resolve(
    translation: string,
    input: string,
  ): Result<ResolvedPassage, ReferenceProblem> {
    const file = this.files.get(translation);
    return file === undefined
      ? {
          ok: false,
          error: {
            code: 'translation',
            message: '사용할 수 없는 역본입니다',
          },
        }
      : resolvePassage(file, input);
  }

  clear(): void {
    this.files.clear();
  }
}

function invalid(file: string, field: string, message: string): FileError {
  return {kind: 'invalid', file, field, message};
}

async function validateContents(
  translation: BibleTranslationFile,
  file: string,
): Promise<FileError | null> {
  for (const [bookIndex, book] of translation.books.entries()) {
    const expected = BIBLE_BOOKS.find(candidate => candidate.id === book.id);
    if (book.chapters.length !== expected?.chapters) {
      return invalid(
        file,
        `books.${bookIndex}.chapters`,
        'Chapter count does not match the book metadata',
      );
    }
    for (const [chapterIndex, chapter] of book.chapters.entries()) {
      const verse = chapter.findIndex(text => text !== text.trim());
      if (verse !== -1) {
        return invalid(
          file,
          `books.${bookIndex}.chapters.${chapterIndex}.${verse}`,
          'Verse text must already be trimmed',
        );
      }
    }
    await setImmediate();
  }
  return null;
}

async function readTranslation(
  folder: string,
  installed: Translation,
): Promise<Result<BibleTranslationFile, FileError>> {
  const file = join(folder, installed.file);
  if (
    basename(installed.file) !== installed.file ||
    /[\\/:]/u.test(installed.file) ||
    extname(installed.file).toLowerCase() !== '.llbible'
  ) {
    return {
      ok: false,
      error: invalid(file, 'file', 'Expected a bare .llbible file name'),
    };
  }
  try {
    if (!(await lstat(file)).isFile()) {
      return {
        ok: false,
        error: invalid(file, '', 'Expected a regular translation file'),
      };
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        kind: 'read',
        file,
        field: '',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
  const loaded = await loadFile(file, parseBibleTranslation);
  if (!loaded.ok) return loaded;
  if (loaded.value === null) {
    return {
      ok: false,
      error: {
        kind: 'read',
        file,
        field: '',
        message: 'Translation file does not exist',
      },
    };
  }
  const translation = loaded.value.data;
  if (translation.id !== installed.id) {
    return {
      ok: false,
      error: invalid(
        file,
        'id',
        'Translation id does not match its installed entry',
      ),
    };
  }
  const problem = await validateContents(translation, file);
  return problem === null
    ? {ok: true, value: translation}
    : {ok: false, error: problem};
}

/** Loads installed files in order, reporting each skipped file once. */
export async function loadBibleLibrary({
  folder,
  translations,
  onProblem,
}: BibleLibraryOptions): Promise<BibleLibrary> {
  const valid: BibleTranslationFile[] = [];
  const ids = new Set<string>();
  for (const installed of translations) {
    if (ids.has(installed.id)) {
      onProblem(
        invalid(
          join(folder, installed.file),
          'id',
          'Duplicate installed translation id',
        ),
      );
      continue;
    }
    ids.add(installed.id);
    const result = await readTranslation(folder, installed);
    if (result.ok) valid.push(result.value);
    else onProblem(result.error);
  }
  return new BibleLibrary(valid);
}
