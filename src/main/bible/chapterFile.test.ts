import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {
  readBibleBytes,
  readBibleChapter,
  readBibleChapterFile,
  type BiblePositionedReader,
} from './chapterFile';
import {BIBLE_HEADER_MAX_BYTES} from './chunkFormat';
import {
  chunkedTranslationFile,
  frameBibleChunks,
  translationFile,
} from '@core/bible/testing/testFiles';

vi.mock('node:fs/promises', async importOriginal => {
  const original = await importOriginal<typeof fs>();
  return {...original, open: vi.fn(original.open)};
});

async function fixtureFile(bytes: Uint8Array) {
  const file = join(await makeTempDir(), 'sample.llbible');
  await fs.writeFile(file, bytes);
  return file;
}

async function observeNextOpen() {
  const original = await vi.importActual<typeof fs>('node:fs/promises');
  const reads: Array<{position: number; length: number}> = [];
  const closed = vi.fn();
  vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
    const handle = await original.open(...args);
    const read = handle.read.bind(handle);
    const close = handle.close.bind(handle);
    const positioned: BiblePositionedReader = {
      async read(options) {
        const {length, position} = options;
        reads.push({position, length});
        return read(options);
      },
    };
    const reader: BiblePositionedReader = handle;
    vi.spyOn(reader, 'read').mockImplementation(positioned.read);
    vi.spyOn(handle, 'close').mockImplementation(async () => {
      closed();
      await close();
    });
    return handle;
  });
  return {reads, closed};
}

describe('positioned Bible file reads', () => {
  it('indexes only the prefix and header, then reads exactly the requested Unicode chapter', async () => {
    const value = translationFile([57, 65]);
    value.books[1]?.chapters.splice(0, 1, [
      'Invented \uD55C\uAE00 sentence.',
      '',
    ]);
    const fixture = chunkedTranslationFile(value);
    const file = await fixtureFile(fixture.bytes);
    const startup = await observeNextOpen();
    const indexed = await readBibleChapterFile(file, 'sample');
    expect(startup.reads).toEqual([
      {position: 0, length: 4},
      {position: 4, length: fixture.dataStart - 4},
    ]);
    expect(startup.closed).toHaveBeenCalledOnce();
    expect(indexed.header).toEqual(fixture.header);
    const lookup = await observeNextOpen();
    expect(await readBibleChapter(indexed, 65, 1)).toEqual([
      'Invented \uD55C\uAE00 sentence.',
      '',
    ]);
    expect(lookup.reads).toEqual([
      {
        position: fixture.dataStart + (fixture.blocks[0]?.length ?? 0),
        length: fixture.blocks[1]?.length,
      },
    ]);
    expect(lookup.closed).toHaveBeenCalledOnce();
  });

  it('loops short reads at advancing buffer and file offsets', async () => {
    const source = Buffer.from('Invented Unicode \uD55C\uAE00 bytes');
    const read = vi.fn<BiblePositionedReader['read']>(
      async ({buffer, offset, length, position}) => {
        const bytesRead = Math.min(3, length, source.length - position);
        source.copy(buffer, offset, position, position + bytesRead);
        return {bytesRead};
      },
    );
    expect(await readBibleBytes({read}, source.length - 2, 2)).toEqual(
      source.subarray(2),
    );
    expect(read.mock.calls[1]?.[0]).toMatchObject({
      offset: 3,
      length: source.length - 5,
      position: 5,
    });
    expect(read.mock.calls.length).toBeGreaterThan(2);
  });

  it('rejects EOF instead of returning partially filled data', async () => {
    const read = vi
      .fn<BiblePositionedReader['read']>()
      .mockResolvedValueOnce({bytesRead: 2})
      .mockResolvedValueOnce({bytesRead: 0});
    await expect(readBibleBytes({read}, 4, 12)).rejects.toThrow(
      'Unexpected end',
    );
  });

  it.each([Buffer.alloc(0), Buffer.from([4, 0]), Buffer.from([0, 0, 0, 0])])(
    'rejects incomplete or empty framing %# and closes the handle',
    async bytes => {
      const file = await fixtureFile(bytes);
      const {closed} = await observeNextOpen();
      await expect(readBibleChapterFile(file, 'sample')).rejects.toThrow();
      expect(closed).toHaveBeenCalledOnce();
    },
  );

  it('rejects oversized and out-of-file header lengths before allocating or reading the header', async () => {
    for (const length of [BIBLE_HEADER_MAX_BYTES + 1, 0xffff_ffff, 32]) {
      const prefix = Buffer.alloc(4);
      prefix.writeUInt32LE(length);
      const file = await fixtureFile(prefix);
      const {reads, closed} = await observeNextOpen();
      await expect(readBibleChapterFile(file, 'sample')).rejects.toThrow();
      expect(reads).toEqual([{position: 0, length: 4}]);
      expect(closed).toHaveBeenCalledOnce();
    }
  });

  it('closes the handle after invalid metadata and rejects mismatched installed ids', async () => {
    const fixture = chunkedTranslationFile(translationFile([57]));
    const file = await fixtureFile(fixture.bytes);
    const {closed} = await observeNextOpen();
    await expect(readBibleChapterFile(file, 'different')).rejects.toThrow(
      'installed entry',
    );
    expect(closed).toHaveBeenCalledOnce();
  });

  it('rejects missing files, directories and symlinks', async () => {
    const folder = await makeTempDir();
    await expect(
      readBibleChapterFile(join(folder, 'missing'), 'sample'),
    ).rejects.toThrow();
    await expect(readBibleChapterFile(folder, 'sample')).rejects.toThrow(
      'regular',
    );
    const link = join(await makeTempDir(), 'linked');
    await fs.symlink(folder, link, 'junction');
    await expect(readBibleChapterFile(link, 'sample')).rejects.toThrow(
      'regular',
    );
  });

  it('does no IO for a chapter outside the validated table', async () => {
    const file = await fixtureFile(
      chunkedTranslationFile(translationFile([57])).bytes,
    );
    const indexed = await readBibleChapterFile(file, 'sample');
    vi.mocked(fs.open).mockClear();
    for (const chapter of [0, -1, 0.5, 2, Infinity, NaN]) {
      await expect(readBibleChapter(indexed, 57, chapter)).rejects.toThrow(
        'outside',
      );
    }
    await expect(readBibleChapter(indexed, 43, 1)).rejects.toThrow('outside');
    expect(fs.open).not.toHaveBeenCalled();
  });

  it('closes the chapter handle after late truncation or invalid contents', async () => {
    const fixture = chunkedTranslationFile(translationFile([57]));
    const file = await fixtureFile(fixture.bytes);
    const indexed = await readBibleChapterFile(file, 'sample');
    await fs.truncate(file, fixture.bytes.length - 1);
    let observed = await observeNextOpen();
    await expect(readBibleChapter(indexed, 57, 1)).rejects.toThrow(
      'Unexpected end',
    );
    expect(observed.closed).toHaveBeenCalledOnce();
    const invalid = Buffer.alloc(fixture.bytes.length - fixture.dataStart, 32);
    await fs.writeFile(file, frameBibleChunks(fixture.header, invalid).bytes);
    observed = await observeNextOpen();
    await expect(readBibleChapter(indexed, 57, 1)).rejects.toThrow('final LF');
    expect(observed.closed).toHaveBeenCalledOnce();
  });
});
