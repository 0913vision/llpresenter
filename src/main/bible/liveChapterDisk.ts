import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {BIBLE_VERSE_COUNTS} from '@core/bible/bibleVerseCounts';
import {BIBLE_LOOKUP_LIMITS} from '@core/schema/bibleLookup';

const MAX_BYTES = 8_388_608;

function location(
  folder: string,
  book: number,
  chapter: number,
): string | null {
  if (
    !Number.isSafeInteger(book) ||
    !Number.isSafeInteger(chapter) ||
    book < 1 ||
    chapter < 1 ||
    BIBLE_VERSE_COUNTS[book - 1]?.[chapter - 1] === undefined
  ) {
    return null;
  }
  return join(folder, 'live', `${book}-${chapter}.json`);
}
function valid(
  value: unknown,
  book: number,
  chapter: number,
): value is string[] {
  const count = BIBLE_VERSE_COUNTS[book - 1]?.[chapter - 1];
  return (
    Array.isArray(value) &&
    value.length === count &&
    value.some(verse => typeof verse === 'string' && verse.trim() !== '') &&
    value.every(
      verse =>
        typeof verse === 'string' &&
        verse.length <= BIBLE_LOOKUP_LIMITS.verseText,
    )
  );
}

/** Cached chapters are untrusted input and never trigger a network request. */
export async function readLiveChapter(
  folder: string,
  book: number,
  chapter: number,
): Promise<readonly string[] | null> {
  const file = location(folder, book, chapter);
  if (file === null) return null;
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_BYTES) return null;
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));
    return valid(value, book, chapter) ? value : null;
  } catch {
    return null;
  }
}

/** Atomic best-effort cache write: output remains usable even if disk fails. */
export async function writeLiveChapter(
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
  const file = location(folder, book, chapter);
  if (file === null || !valid(verses, book, chapter)) return;
  const data = JSON.stringify(verses);
  if (Buffer.byteLength(data) > MAX_BYTES) return;
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await mkdir(join(folder, 'live'), {recursive: true});
    await writeFile(temporary, data, 'utf8');
    await rename(temporary, file);
  } catch {
    await unlink(temporary).catch(() => undefined);
  }
}
