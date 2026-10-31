import * as fs from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../test/temp-dir';
import {
  readBibleChapter,
  readBibleChapterFile,
} from '../../src/main/bible/chapterFile';
import {translationFile} from '@core/bible/testing/testFiles';
import {convertBibleFile} from './convert';

vi.mock('node:fs/promises', async importOriginal => {
  const original = await importOriginal<typeof fs>();
  return {
    ...original,
    rename: vi.fn(original.rename),
    open: vi.fn(original.open),
  };
});

beforeEach(async () => {
  const original = await vi.importActual<typeof fs>('node:fs/promises');
  vi.mocked(fs.rename).mockReset().mockImplementation(original.rename);
  vi.mocked(fs.open).mockReset().mockImplementation(original.open);
});

async function setup() {
  const folder = await makeTempDir();
  const source = join(folder, 'source.llbible');
  const destination = join(folder, 'destination.llbible');
  const text = `${JSON.stringify(translationFile([57]), null, 2)}\n`;
  await fs.writeFile(source, text);
  return {folder, source, destination, text};
}

describe('atomic Bible file conversion', () => {
  it('flushes and closes a same-folder temporary file before rename, producing a readable v2 file', async () => {
    const {source, destination, text} = await setup();
    const original = await vi.importActual<typeof fs>('node:fs/promises');
    const events: string[] = [];
    vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
      expect(args[0]).not.toBe(destination);
      const handle = await original.open(...args);
      const sync = handle.sync.bind(handle);
      const close = handle.close.bind(handle);
      vi.spyOn(handle, 'sync').mockImplementation(async () => {
        await sync();
        events.push('sync');
      });
      vi.spyOn(handle, 'close').mockImplementation(async () => {
        await close();
        events.push('close');
      });
      return handle;
    });
    vi.mocked(fs.rename).mockImplementationOnce(async (from, to) => {
      expect(String(from)).toContain('.tmp');
      expect(dirname(String(from))).toBe(dirname(destination));
      expect(to).toBe(destination);
      events.push('rename');
      await original.rename(from, to);
    });
    await convertBibleFile(source, destination);
    expect(events).toEqual(['sync', 'close', 'rename']);
    expect(await fs.readFile(source, 'utf8')).toBe(text);
    const indexed = await readBibleChapterFile(destination, 'sample');
    expect(await readBibleChapter(indexed, 57, 1)).toEqual(
      translationFile([57]).books[0]?.chapters[0],
    );
  });

  it('preserves an existing destination on rename failure, removes its temporary file and recovers on retry', async () => {
    const {folder, source, destination, text} = await setup();
    await fs.writeFile(destination, 'Previous destination');
    vi.mocked(fs.rename).mockRejectedValue(
      Object.assign(new Error('Injected rename denied'), {code: 'EPERM'}),
    );
    await expect(convertBibleFile(source, destination)).rejects.toThrow(
      'rename denied',
    );
    expect(await fs.readFile(destination, 'utf8')).toBe('Previous destination');
    expect(await fs.readFile(source, 'utf8')).toBe(text);
    expect((await fs.readdir(folder)).sort()).toEqual([
      'destination.llbible',
      'source.llbible',
    ]);
    const original = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(fs.rename).mockImplementation(original.rename);
    await convertBibleFile(source, destination);
    expect(
      (await readBibleChapterFile(destination, 'sample')).header.schemaVersion,
    ).toBe(2);
  });

  it('preserves the destination and never renames after a flush failure', async () => {
    const {folder, source, destination} = await setup();
    await fs.writeFile(destination, 'Previous destination');
    const original = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
      const handle = await original.open(...args);
      vi.spyOn(handle, 'sync').mockRejectedValue(
        new Error('Injected flush failure'),
      );
      return handle;
    });
    await expect(convertBibleFile(source, destination)).rejects.toThrow(
      'flush failure',
    );
    expect(fs.rename).not.toHaveBeenCalled();
    expect(await fs.readFile(destination, 'utf8')).toBe('Previous destination');
    expect((await fs.readdir(folder)).sort()).toEqual([
      'destination.llbible',
      'source.llbible',
    ]);
  });

  it('rejects same-path and hard-link aliases without changing the source', async () => {
    const {folder, source, text} = await setup();
    await expect(
      convertBibleFile(source, join(folder, '.', 'source.llbible')),
    ).rejects.toThrow('different files');
    const alias = join(folder, 'alias.llbible');
    await fs.link(source, alias);
    await expect(convertBibleFile(source, alias)).rejects.toThrow('same file');
    expect(await fs.readFile(source, 'utf8')).toBe(text);
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('validates bad input before touching an existing destination', async () => {
    const {source, destination} = await setup();
    await fs.writeFile(source, '{');
    await fs.writeFile(destination, 'Previous destination');
    await expect(convertBibleFile(source, destination)).rejects.toThrow();
    expect(await fs.readFile(destination, 'utf8')).toBe('Previous destination');
    expect(fs.open).not.toHaveBeenCalled();
  });
});
