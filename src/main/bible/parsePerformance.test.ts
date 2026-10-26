import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {expect, it} from 'vitest';
import {parseBibleTranslation} from '@shared/schema/bibleTranslation';
import {BIBLE_BOOKS} from '@shared/bibleBooks';
import {FULL_TRANSLATION_VERSES, fullTranslationText} from './testFiles';

it('measures the median of three warmed full-size parses independently of file I/O', async () => {
  const text = fullTranslationText();
  const bytes = Buffer.byteLength(text);
  expect(bytes).toBeGreaterThanOrEqual(4_000_000);
  expect(bytes).toBeLessThanOrEqual(5_000_000);
  const result = parseBibleTranslation(text, 'full.llbible');
  const samplesMs = Array.from({length: 3}, () => {
    const started = performance.now();
    const measured = parseBibleTranslation(text, 'full.llbible');
    const elapsed = performance.now() - started;
    expect(measured.ok).toBe(true);
    return elapsed;
  });
  const medianMs = samplesMs.toSorted((a, b) => a - b)[1];
  if (medianMs === undefined) throw new Error('Missing parse timing samples');
  const budgetMs = 100;
  const coverage = resolve('coverage');
  await mkdir(coverage, {recursive: true});
  await writeFile(
    join(coverage, 'bible-parse-budget.json'),
    `${JSON.stringify(
      {
        bytes,
        books: BIBLE_BOOKS.length,
        chapters: BIBLE_BOOKS.reduce((total, book) => total + book.chapters, 0),
        verses: FULL_TRANSLATION_VERSES,
        warmupRuns: 1,
        samplesMs,
        medianMs,
        budgetMs,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      null,
      2,
    )}\n`,
  );
  console.info(
    `Parse ${bytes} bytes, ${FULL_TRANSLATION_VERSES} verses: median ${medianMs.toFixed(3)} ms (${samplesMs.map(sample => sample.toFixed(3)).join(', ')})`,
  );
  expect(medianMs).toBeLessThan(budgetMs);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  expect(result.value.data.books).toHaveLength(66);
  expect(result.value.data.books.map(book => book.chapters.length)).toEqual(
    BIBLE_BOOKS.map(book => book.chapters),
  );
  expect(
    result.value.data.books.reduce(
      (total, book) =>
        total +
        book.chapters.reduce((count, chapter) => count + chapter.length, 0),
      0,
    ),
  ).toBe(FULL_TRANSLATION_VERSES);
});
