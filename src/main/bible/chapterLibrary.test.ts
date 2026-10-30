import {truncate, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import type {Translation} from '@core/schema/bible';
import type {FileError} from '@core/schema/fileFormat';
import {makeTempDir} from '../../../test/temp-dir';
import * as chapterFile from './chapterFile';
import {loadBibleChapterLibrary} from './chapterLibrary';
import {
  chunkedTranslationFile,
  parsedTranslation,
  translationFile,
} from './testFiles';

function installed(id = 'sample', file = `${id}.llbible`): Translation {
  return {
    id: parsedTranslation({...translationFile([]), id}).id,
    name: 'Invented translation',
    lang: 'ko',
    file,
    default: false,
  };
}

async function setup(ids = ['sample'], books = [43]) {
  const folder = await makeTempDir();
  for (const id of ids) {
    const fixture = chunkedTranslationFile({...translationFile(books), id});
    await writeFile(join(folder, `${id}.llbible`), fixture.bytes);
  }
  const onProblem = vi.fn<(problem: FileError) => void>();
  const library = await loadBibleChapterLibrary({
    folder,
    translations: ids.map(id => installed(id)),
    onProblem,
  });
  return {folder, library, onProblem};
}

describe('indexed Bible chapter library', () => {
  it('keeps only installed headers until a chapter is requested and retains hits', async () => {
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    const {folder, library, onProblem} = await setup();
    expect(read).not.toHaveBeenCalled();
    expect(library.translations.map(header => header.id)).toEqual(['sample']);
    expect(library.header('sample')?.books[0]?.chapters[2]?.verses).toBe(36);
    const verses = await library.chapter('sample', 43, 3);
    expect(verses?.[15]).toBe('Invented book 43, chapter 3, verse 16');
    await unlink(join(folder, 'sample.llbible'));
    expect(await library.chapter('sample', 43, 3)).toBe(verses);
    expect(read).toHaveBeenCalledOnce();
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('does no chapter IO for a missing identity, book or invalid chapter', async () => {
    const {library, onProblem} = await setup();
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    expect(await library.chapter('missing', 43, 1)).toBeNull();
    expect(await library.chapter('sample', 57, 1)).toBeNull();
    for (const chapter of [0, -1, 0.5, NaN, 22]) {
      expect(await library.chapter('sample', 43, chapter)).toBeNull();
    }
    expect(read).not.toHaveBeenCalled();
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('shares LRU eviction across translation identities', async () => {
    const {library} = await setup(['first', 'second'], [19]);
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    for (let chapter = 1; chapter <= 32; chapter++) {
      await library.chapter(chapter % 2 ? 'first' : 'second', 19, chapter);
    }
    const recent = await library.chapter('first', 19, 1);
    await library.chapter('second', 19, 33);
    expect(await library.chapter('first', 19, 1)).toBe(recent);
    expect(read).toHaveBeenCalledTimes(33);
    await library.chapter('second', 19, 2);
    expect(read).toHaveBeenCalledTimes(34);
  });

  it('invalidates all cached chapters of a late broken file and warns once', async () => {
    const {folder, library, onProblem} = await setup(['broken', 'good']);
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    await library.chapter('broken', 43, 1);
    const good = await library.chapter('good', 43, 1);
    const file = join(folder, 'broken.llbible');
    await truncate(file, 4);
    expect(await library.chapter('broken', 43, 2)).toBeNull();
    expect(await library.chapter('broken', 43, 1)).toBeNull();
    expect(await library.chapter('broken', 43, 2)).toBeNull();
    expect(library.header('broken')).toBeUndefined();
    expect(library.translations.map(header => header.id)).toEqual(['good']);
    expect(await library.chapter('good', 43, 1)).toBe(good);
    expect(read).toHaveBeenCalledTimes(3);
    expect(onProblem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({file}),
    );
  });

  it.each([false, true])(
    'does not publish or refill a pending read after clear, failure=%s',
    async fails => {
      const {library, onProblem} = await setup();
      let finish: () => void = () => undefined;
      const pending = new Promise<readonly string[]>((resolve, reject) => {
        finish = () =>
          fails
            ? reject(new Error('Late failure'))
            : resolve(['Invented late sentence.']);
      });
      const read = vi
        .spyOn(chapterFile, 'readBibleChapter')
        .mockReturnValueOnce(pending);
      const lookup = library.chapter('sample', 43, 1);
      expect(read).toHaveBeenCalledOnce();
      library.clear();
      library.clear();
      finish();
      expect(await lookup).toBeNull();
      expect(library.translations).toEqual([]);
      expect(await library.chapter('sample', 43, 1)).toBeNull();
      expect(onProblem).not.toHaveBeenCalled();
      expect(read).toHaveBeenCalledOnce();
    },
  );

  it('skips a broken header once while retaining the next valid translation', async () => {
    const {folder} = await setup(['good']);
    await writeFile(
      join(folder, 'broken.llbible'),
      Buffer.from([1, 0, 0, 0, 255]),
    );
    const onProblem = vi.fn<(problem: FileError) => void>();
    const library = await loadBibleChapterLibrary({
      folder,
      translations: [installed('broken'), installed('good')],
      onProblem,
    });
    expect(library.translations.map(header => header.id)).toEqual(['good']);
    expect(await library.chapter('broken', 43, 1)).toBeNull();
    expect(await library.chapter('broken', 43, 1)).toBeNull();
    expect(onProblem).toHaveBeenCalledOnce();
  });

  it('rejects invalid installed paths and duplicates without reading arbitrary files', async () => {
    const {folder} = await setup();
    const onProblem = vi.fn<(problem: FileError) => void>();
    const read = vi.spyOn(chapterFile, 'readBibleChapterFile');
    const library = await loadBibleChapterLibrary({
      folder,
      translations: [
        installed(),
        installed('sample', 'duplicate.llbible'),
        installed('parent', '../outside.llbible'),
        installed('extension', 'other.json'),
        installed('missing'),
        installed('missing'),
      ],
      onProblem,
    });
    expect(library.translations.map(header => header.id)).toEqual(['sample']);
    expect(read).toHaveBeenCalledTimes(2);
    expect(onProblem).toHaveBeenCalledTimes(4);
  });

  it('keeps the first installed identity even when its file is broken', async () => {
    const {folder} = await setup();
    const onProblem = vi.fn<(problem: FileError) => void>();
    const read = vi.spyOn(chapterFile, 'readBibleChapterFile');
    const library = await loadBibleChapterLibrary({
      folder,
      translations: [installed('sample', 'missing.llbible'), installed()],
      onProblem,
    });
    expect(library.translations).toEqual([]);
    expect(read).toHaveBeenCalledOnce();
    expect(onProblem).toHaveBeenCalledTimes(2);
  });
});
