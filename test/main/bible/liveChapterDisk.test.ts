import {readFile, readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {BIBLE_VERSE_COUNTS} from '@core/bible/bibleVerseCounts';
import {makeTempDir} from '@fixtures/tempDir';
import {readLiveChapter, writeLiveChapter} from '@main/bible/liveChapterDisk';

function versesOf(book: number, chapter: number): string[] {
  const count = BIBLE_VERSE_COUNTS[book - 1]?.[chapter - 1];
  if (count === undefined) throw Error('No such chapter');
  return Array.from({length: count}, (_, index) => `Verse ${index + 1}`);
}

describe('the disk copy of a live Bible chapter', () => {
  it('keeps a chapter under live as its book and chapter, and reads it back', async () => {
    const folder = await makeTempDir();
    const verses = versesOf(43, 3);
    await writeLiveChapter(folder, {book: 43, chapter: 3, verses});
    expect(
      JSON.parse(await readFile(join(folder, 'live', '43-3.json'), 'utf8')),
    ).toEqual(verses);
    expect(await readLiveChapter(folder, 43, 3)).toEqual(verses);
    expect(await readdir(join(folder, 'live'))).toEqual(['43-3.json']);
  });

  it('reads nothing from a missing, broken or wrong-length copy', async () => {
    const folder = await makeTempDir();
    expect(await readLiveChapter(folder, 1, 1)).toBeNull();
    await writeLiveChapter(folder, {
      book: 1,
      chapter: 1,
      verses: versesOf(1, 1),
    });
    await writeFile(join(folder, 'live', '1-1.json'), '{bad');
    expect(await readLiveChapter(folder, 1, 1)).toBeNull();
    await writeFile(join(folder, 'live', '1-1.json'), '["one"]');
    expect(await readLiveChapter(folder, 1, 1)).toBeNull();
  });

  it('keeps nothing that does not fit the chapter, or a chapter the Bible does not have', async () => {
    const folder = await makeTempDir();
    await writeLiveChapter(folder, {book: 1, chapter: 1, verses: ['one']});
    await writeLiveChapter(folder, {
      book: 1,
      chapter: 1,
      verses: versesOf(1, 1).map(() => ' '),
    });
    await writeLiveChapter(folder, {book: 1, chapter: 51, verses: ['one']});
    expect(await readdir(folder)).toEqual([]);
    expect(await readLiveChapter(folder, 0, 1)).toBeNull();
    expect(await readLiveChapter(folder, 1, 51)).toBeNull();
  });
});
