import {describe, expect, it, vi} from 'vitest';
import {parseBibleChunkHeader as parseContainer} from '@core/schema/bibleChunks';
import {parseBibleChunkHeader} from '@main/bible/chunkFormat';
import {
  chunkedTranslationFile,
  translationFile,
} from '@fixtures/core/bible/testFiles';

vi.mock('@core/schema/bibleChunks', async importOriginal => ({
  ...(await importOriginal<typeof import('@core/schema/bibleChunks')>()),
  parseBibleChunkHeader: vi.fn(),
}));

const actual = await vi.importActual<typeof import('@core/schema/bibleChunks')>(
  '@core/schema/bibleChunks',
);

/** A container header for John and Philemon with every chapter. */
function canonicalHeader() {
  const fixture = chunkedTranslationFile(translationFile([43, 57]));
  return actual.parseBibleChunkHeader(
    fixture.bytes.subarray(4, fixture.dataStart),
    fixture.bytes.length - fixture.dataStart,
    'sample',
  );
}

describe('parseBibleChunkHeader', () => {
  it('passes a header whose books have their canonical chapter counts', () => {
    const header = canonicalHeader();
    vi.mocked(parseContainer).mockReturnValue(header);
    const bytes = new Uint8Array([1]);

    expect(parseBibleChunkHeader(bytes, 10, 'sample')).toBe(header);
    expect(parseContainer).toHaveBeenCalledWith(bytes, 10, 'sample');
  });

  it('rejects a book with another chapter count than the canonical one', () => {
    const header = canonicalHeader();
    const john = header.books[0];
    if (john === undefined) throw new Error('Missing John');
    vi.mocked(parseContainer).mockReturnValue({
      ...header,
      books: [{...john, chapters: john.chapters.slice(0, 1)}],
    });

    expect(() =>
      parseBibleChunkHeader(new Uint8Array([1]), 10, 'sample'),
    ).toThrow('Invalid Bible chapter count');
  });
});
