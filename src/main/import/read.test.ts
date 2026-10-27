import {readFile, readdir, writeFile} from 'node:fs/promises';
import * as files from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {readTextImport, type TextImportInputs} from './read';
import {TEXT_IMPORT_LIMITS} from './limits';
import {convertTextImport} from './convert';
import {encodedTextSamples, testText} from './testText';

function inputs(
  path: string | null,
  text = 'Clipboard text',
): TextImportInputs {
  return {chooseFile: async () => path, readClipboard: async () => text};
}

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof files>();
  return {...actual, open: vi.fn(actual.open)};
});

describe('text import input reads', () => {
  it('rejects replacement characters when reading the clipboard', async () => {
    expect(
      await readTextImport(
        {source: 'clipboard', encoding: 'auto'},
        inputs(null, 'Bad\uFFFDtext'),
      ),
    ).toMatchObject({ok: false, error: {reason: 'decode-failed'}});
  });

  it('refuses a file that grows beyond the size used for the read buffer', async () => {
    const path = join(await makeTempDir(), 'Changed.txt');
    await writeFile(path, 'More text than the earlier size');
    const actual = await vi.importActual<typeof files>('node:fs/promises');
    vi.mocked(files.open).mockImplementationOnce(async () => {
      const file = await actual.open(path, 'r');
      const info = await file.stat();
      info.size = 1;
      const stat = vi.spyOn(file, 'stat').mockResolvedValueOnce(info);
      onTestFinished(() => stat.mockRestore());
      return file;
    });
    expect(
      await readTextImport({source: 'file', encoding: 'auto'}, inputs(path)),
    ).toMatchObject({
      ok: false,
      error: {
        reason: 'read-failed',
        message: 'The text file grew while it was read',
      },
    });
  });

  it.each(encodedTextSamples)(
    'reads a %s file and builds the same draft',
    async (_name, bytes) => {
      const path = join(await makeTempDir(), 'Example.txt');
      await writeFile(path, bytes);
      const read = await readTextImport(
        {source: 'file', encoding: 'auto'},
        inputs(path),
      );
      if (!read.ok || read.value === null) {
        throw new Error('Expected a retained text source');
      }
      expect(read.value.text).toBe(testText);
      expect(
        convertTextImport({
          source: read.value,
          options: {
            split: 'lineBreak',
            unitsPerSlide: 2,
            labels: 'bracketLine',
            firstLine: 'lyrics',
          },
        }),
      ).toEqual({
        ok: true,
        value: {
          title: 'Example',
          slides: [
            {lines: ['첫째 문장', '뷁 새 문장'], section: 0},
            {label: '후렴', lines: ['마지막 문장'], section: 1},
          ],
        },
      });
    },
  );

  it('retains the file name and decoded text without changing any files', async () => {
    const folder = await makeTempDir();
    const path = join(folder, 'Example.txt');
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('One\r\nTwo', 'utf16le'),
    ]);
    await writeFile(path, bytes);
    expect(
      await readTextImport({source: 'file', encoding: 'auto'}, inputs(path)),
    ).toEqual({
      ok: true,
      value: {source: 'file', fileName: 'Example.txt', text: 'One\r\nTwo'},
    });
    expect(await readFile(path)).toEqual(bytes);
    expect(await readdir(folder)).toEqual(['Example.txt']);
  });

  it('returns a null success for a cancelled file selection', async () => {
    expect(
      await readTextImport({source: 'file', encoding: 'auto'}, inputs(null)),
    ).toEqual({ok: true, value: null});
  });

  it('awaits clipboard input and keeps its source distinct from files', async () => {
    expect(
      await readTextImport(
        {source: 'clipboard', encoding: 'cp949'},
        inputs(null, '첫째 문장'),
      ),
    ).toEqual({
      ok: true,
      value: {source: 'clipboard', fileName: null, text: '첫째 문장'},
    });
    expect(
      await readTextImport(
        {source: 'clipboard', encoding: 'auto'},
        inputs(null, ' \n'),
      ),
    ).toMatchObject({ok: false, error: {reason: 'empty'}});
  });

  it('returns typed failures for missing paths, directories, and native input errors', async () => {
    const folder = await makeTempDir();
    for (const path of [folder, join(folder, 'missing.txt')]) {
      expect(
        await readTextImport({source: 'file', encoding: 'auto'}, inputs(path)),
      ).toMatchObject({ok: false, error: {reason: 'read-failed'}});
    }
    const failing: TextImportInputs = {
      chooseFile: async () => {
        throw new Error('Dialog unavailable');
      },
      readClipboard: async () => {
        throw new Error('Clipboard unavailable');
      },
    };
    for (const source of ['file', 'clipboard'] as const) {
      expect(
        await readTextImport({source, encoding: 'auto'}, failing),
      ).toMatchObject({ok: false, error: {reason: 'read-failed'}});
    }
  });

  it('refuses oversized file bytes, decoded text, and clipboard text', async () => {
    const folder = await makeTempDir();
    const path = join(folder, 'Large.txt');
    await writeFile(path, Buffer.alloc(TEXT_IMPORT_LIMITS.bytes + 1));
    expect(
      await readTextImport({source: 'file', encoding: 'auto'}, inputs(path)),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    const text = 'a'.repeat(TEXT_IMPORT_LIMITS.characters + 1);
    await writeFile(path, text);
    expect(
      await readTextImport({source: 'file', encoding: 'auto'}, inputs(path)),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await readTextImport(
        {source: 'clipboard', encoding: 'auto'},
        inputs(null, text),
      ),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
  });

  it('preserves files after a decoding failure', async () => {
    const folder = await makeTempDir();
    const path = join(folder, 'Broken.txt');
    const bytes = Buffer.from([0xff, 0xfe, 0x00]);
    await writeFile(path, bytes);
    expect(
      await readTextImport({source: 'file', encoding: 'auto'}, inputs(path)),
    ).toMatchObject({ok: false, error: {reason: 'decode-failed'}});
    expect(await readFile(path)).toEqual(bytes);
  });
});
