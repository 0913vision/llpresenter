import {readFile, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import type {Translation} from '@shared/schema/bible';
import type {FileError} from '@shared/schema/fileFormat';
import {makeTempDir} from '../../../test/temp-dir';
import * as chapterFile from './chapterFile';
import {loadBibleLibrary} from './library';
import {
  chunkedTranslationFile,
  frameBibleChunks,
  parsedTranslation,
  translationFile,
} from './testFiles';

function installed(file = 'sample.llbible', id = 'sample'): Translation {
  return {
    id: parsedTranslation({...translationFile([]), id}).id,
    name: 'Invented translation',
    lang: 'ko',
    file,
    default: false,
  };
}

async function setup(
  bytes = chunkedTranslationFile(translationFile([43, 57])).bytes,
) {
  const folder = await makeTempDir();
  const file = join(folder, 'sample.llbible');
  await writeFile(file, bytes);
  const onProblem = vi.fn<(problem: FileError) => void>();
  const library = await loadBibleLibrary({
    folder,
    translations: [installed()],
    onProblem,
  });
  return {folder, file, library, onProblem};
}

describe('indexed Bible passage library', () => {
  it('loads partial translation headers without writing and resolves cached passages', async () => {
    const fixture = chunkedTranslationFile(translationFile([43, 57]));
    const bytes = frameBibleChunks(
      {...fixture.header, extension: {kept: true}},
      Buffer.concat(fixture.blocks),
    ).bytes;
    const {file, library, onProblem} = await setup(bytes);
    expect(library.translations).toHaveLength(1);
    expect(library.translations[0]).toMatchObject({extension: {kept: true}});
    expect(await readFile(file)).toEqual(bytes);
    const result = await library.resolve('sample', 'John3:16-18');
    expect(result).toMatchObject({
      ok: true,
      value: {verses: [{verse: 16}, {verse: 17}, {verse: 18}]},
    });
    expect(await library.resolve('sample', 'Philemon1:1')).toMatchObject({
      ok: true,
    });
    await unlink(file);
    expect(await library.resolve('sample', 'John3:16-18')).toEqual(result);
    expect(await library.resolve('missing', 'John3:16')).toMatchObject({
      ok: false,
      error: {code: 'translation'},
    });
    expect(onProblem).not.toHaveBeenCalled();
    library.clear();
    expect(library.translations).toEqual([]);
    expect(await library.resolve('sample', 'John3:16')).toMatchObject({
      ok: false,
      error: {code: 'translation'},
    });
  });

  it.each([
    ['John22:1', 'chapter'],
    ['John3:40', 'verse'],
    ['John3:16-99', 'verse'],
    ['John3:35-4:9', 'verse'],
    ['John4:2-3:16', 'reversed'],
    ['Genesis1:1', 'missingBook'],
    ['John', 'syntax'],
  ])(
    'rejects %s from the header without reading any chapter',
    async (input, code) => {
      const {library} = await setup();
      const read = vi.spyOn(chapterFile, 'readBibleChapter');
      expect(await library.resolve('sample', input)).toMatchObject({
        ok: false,
        error: {code},
      });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('reads only the requested chapters and preserves omitted slots across a boundary', async () => {
    const value = translationFile();
    value.books[0]?.chapters[2]?.splice(34, 2, '', 'Invented final sentence.');
    value.books[0]?.chapters[3]?.splice(0, 2, '', 'Invented next sentence.');
    const {library} = await setup(chunkedTranslationFile(value).bytes);
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    expect(await library.resolve('sample', 'John3:35-4:2')).toMatchObject({
      ok: true,
      value: {
        verses: [
          {chapter: 3, verse: 36, text: 'Invented final sentence.'},
          {chapter: 4, verse: 2, text: 'Invented next sentence.'},
        ],
      },
    });
    expect(read.mock.calls.map(([, book, chapter]) => [book, chapter])).toEqual(
      [
        [43, 3],
        [43, 4],
      ],
    );
    expect(await library.resolve('sample', 'John3:35')).toMatchObject({
      ok: false,
      error: {code: 'omitted'},
    });
  });

  it('allows the verse-count limit and rejects a larger range before any reads', async () => {
    const value = translationFile();
    const first = Array<string>(20_000).fill('');
    const second = [...first];
    first[0] = 'Invented first sentence.';
    second[0] = 'Invented second sentence.';
    value.books[0]?.chapters.splice(0, 2, first, second);
    const {library} = await setup(chunkedTranslationFile(value).bytes);
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    expect(await library.resolve('sample', 'John1:1-3:1')).toMatchObject({
      ok: false,
      error: {code: 'verse'},
    });
    expect(read).not.toHaveBeenCalled();
    expect(await library.resolve('sample', 'John1:1-2:20000')).toMatchObject({
      ok: true,
      value: {
        verses: [
          {chapter: 1, verse: 1},
          {chapter: 2, verse: 1},
        ],
      },
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('returns a translation error and warns once after an uncached read fails', async () => {
    const {file, library, onProblem} = await setup();
    await library.resolve('sample', 'John3:16');
    await unlink(file);
    expect(await library.resolve('sample', 'John4:1')).toMatchObject({
      ok: false,
      error: {code: 'translation'},
    });
    expect(await library.resolve('sample', 'John3:16')).toMatchObject({
      ok: false,
      error: {code: 'translation'},
    });
    expect(onProblem).toHaveBeenCalledOnce();
  });

  it('skips legacy whole-file JSON at runtime without converting it', async () => {
    const bytes = Buffer.from(JSON.stringify(translationFile()));
    const {file, library, onProblem} = await setup(bytes);
    expect(library.translations).toEqual([]);
    expect(await readFile(file)).toEqual(bytes);
    expect(onProblem).toHaveBeenCalledOnce();
  });
});
