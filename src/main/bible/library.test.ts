import {mkdir, readFile, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import type {Translation} from '@shared/schema/bible';
import type {FileError} from '@shared/schema/fileFormat';
import {makeTempDir} from '../../../test/temp-dir';
import {loadBibleLibrary} from './library';
import {parsedTranslation, translationFile} from './testFiles';

function installed(file = 'sample.llbible', id = 'sample'): Translation {
  return {
    id: parsedTranslation({...translationFile(), id}).id,
    name: 'Invented translation',
    lang: '한국어',
    file,
    default: false,
  };
}

describe('Bible library loading', () => {
  it('loads a partial translation without writing, then answers from memory and releases its entries', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'sample.llbible');
    const text = JSON.stringify(
      {...translationFile([43, 57]), extension: {kept: true}},
      null,
      4,
    );
    await writeFile(file, text);
    const onProblem = vi.fn<(problem: FileError) => void>();
    const library = await loadBibleLibrary({
      folder,
      translations: [installed()],
      onProblem,
    });
    expect(onProblem).not.toHaveBeenCalled();
    expect(library.translations).toHaveLength(1);
    expect(library.translations[0]).toMatchObject({extension: {kept: true}});
    expect(await readFile(file, 'utf8')).toBe(text);
    await unlink(file);
    expect(library.resolve('sample', '요 3:16-18')).toMatchObject({
      ok: true,
      value: {verses: [{verse: 16}, {verse: 17}, {verse: 18}]},
    });
    expect(library.resolve('sample', '요 3장 16-18절')).toEqual(
      library.resolve('sample', '요 3:16-18'),
    );
    expect(library.resolve('sample', '몬1:1')).toMatchObject({
      ok: true,
      value: {ref: '빌레몬서 1:1'},
    });
    expect(library.resolve('missing', '요3:16')).toMatchObject({
      ok: false,
      error: {code: 'translation'},
    });
    library.clear();
    expect(library.translations).toEqual([]);
    expect(library.resolve('sample', '요3:16')).toMatchObject({
      ok: false,
      error: {code: 'translation'},
    });
  });

  it.each(
    [
      ['invalid JSON', '{', 'json', ''],
      [
        'wrong format',
        {...translationFile(), format: 'other'},
        'format',
        'format',
      ],
      [
        'wrong chapter count',
        {...translationFile(), books: [{id: 43, chapters: [['Invented']]}]},
        'invalid',
        'books.0.chapters',
      ],
      [
        'untrimmed verse',
        {
          ...translationFile([57]),
          books: [{id: 57, chapters: [[' Invented ']]}],
        },
        'invalid',
        'books.0.chapters.0.0',
      ],
      [
        'duplicate books',
        {
          ...translationFile([57]),
          books: [
            {id: 57, chapters: [['Invented']]},
            {id: 57, chapters: [['Invented']]},
          ],
        },
        'invalid',
        'books.1',
      ],
      [
        'out-of-order books',
        {
          ...translationFile(),
          books: [...translationFile([43, 57]).books].reverse(),
        },
        'invalid',
        'books.1',
      ],
      [
        'empty chapter',
        {...translationFile([57]), books: [{id: 57, chapters: [[]]}]},
        'invalid',
        'books.0.chapters.0',
      ],
      [
        'wrong installed identity',
        {...translationFile(), id: 'other'},
        'invalid',
        'id',
      ],
    ].map(([name, invalid, kind, field]) => ({name, invalid, kind, field})),
  )(
    'skips $name with one problem event while keeping the next valid translation',
    async ({invalid, kind, field}) => {
      const folder = await makeTempDir();
      const file = join(folder, 'bad.llbible');
      const text =
        typeof invalid === 'string' ? invalid : JSON.stringify(invalid);
      await writeFile(file, text);
      await writeFile(
        join(folder, 'good.llbible'),
        JSON.stringify({...translationFile(), id: 'good'}),
      );
      const onProblem = vi.fn<(problem: FileError) => void>();
      const library = await loadBibleLibrary({
        folder,
        translations: [
          installed('bad.llbible'),
          installed('good.llbible', 'good'),
        ],
        onProblem,
      });
      expect(onProblem).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({file, kind, field}),
      );
      expect(library.translations.map(translation => translation.id)).toEqual([
        'good',
      ]);
      expect(library.resolve('good', '요3:16')).toMatchObject({ok: true});
      expect(await readFile(file, 'utf8')).toBe(text);
    },
  );

  it.each(['missing.llbible', '../sample.llbible', 'sample.json'])(
    'reports an unavailable or unsupported installed file %j once',
    async file => {
      const folder = await makeTempDir();
      const onProblem = vi.fn<(problem: FileError) => void>();
      const library = await loadBibleLibrary({
        folder,
        translations: [installed(file)],
        onProblem,
      });
      expect(library.translations).toEqual([]);
      expect(onProblem).toHaveBeenCalledTimes(1);
    },
  );

  it('refuses directories and ignores files that are not installed', async () => {
    const folder = await makeTempDir();
    await mkdir(join(folder, 'sample.llbible'));
    await writeFile(join(folder, 'not-installed.llbible'), 'broken JSON');
    const onProblem = vi.fn<(problem: FileError) => void>();
    const library = await loadBibleLibrary({
      folder,
      translations: [installed()],
      onProblem,
    });
    expect(library.translations).toEqual([]);
    expect(onProblem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        kind: 'invalid',
        message: 'Expected a regular translation file',
      }),
    );
    onProblem.mockClear();
    await loadBibleLibrary({folder, translations: [], onProblem});
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('keeps the first installed identity and reports a duplicate once', async () => {
    const folder = await makeTempDir();
    await writeFile(
      join(folder, 'sample.llbible'),
      JSON.stringify(translationFile()),
    );
    const onProblem = vi.fn<(problem: FileError) => void>();
    const library = await loadBibleLibrary({
      folder,
      translations: [installed(), installed('duplicate.llbible')],
      onProblem,
    });
    expect(library.translations).toHaveLength(1);
    expect(onProblem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        field: 'id',
        message: 'Duplicate installed translation id',
      }),
    );
  });
});
