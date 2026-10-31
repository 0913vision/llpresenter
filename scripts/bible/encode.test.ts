import {describe, expect, it} from 'vitest';
import {
  BIBLE_HEADER_MAX_BYTES,
  parseBibleChunkHeader,
} from '../../src/main/bible/chunkFormat';
import {translationFile} from '@core/bible/testing/testFiles';
import {encodeChunkedBible} from './encode';

function encode(value: unknown) {
  return encodeChunkedBible(
    Buffer.from(JSON.stringify(value)),
    'invented.llbible',
  );
}

describe('chunked Bible encoder', () => {
  it('uses UTF-8 byte offsets and preserves unknown metadata, Unicode and omitted slots', () => {
    const value = translationFile([57, 65]);
    const first = [
      'Invented \uD55C\uAE00 sentence.',
      '',
      'Invented \u{1f680} sentence.',
    ];
    const second = ['Invented second chapter.'];
    value.books[0]?.chapters.splice(0, 1, first);
    value.books[1]?.chapters.splice(0, 1, second);
    const input = {
      ...value,
      future: {kept: true},
      source: {...value.source, future: ['kept']},
      books: value.books.map(book => ({...book, future: book.id})),
    };
    const encoded = encode(input);
    const dataStart = 4 + encoded.readUInt32LE();
    const blocks = [first, second].map(verses =>
      Buffer.from(`${JSON.stringify(verses)}\n`),
    );
    const header = parseBibleChunkHeader(
      encoded.subarray(4, dataStart),
      encoded.length - dataStart,
      'sample',
    );
    expect(header).toMatchObject({
      schemaVersion: 2,
      future: {kept: true},
      source: {future: ['kept']},
      books: [
        {
          id: 57,
          future: 57,
          chapters: [{offset: 0, bytes: blocks[0]?.length, verses: 3}],
        },
        {
          id: 65,
          future: 65,
          chapters: [
            {offset: blocks[0]?.length, bytes: blocks[1]?.length, verses: 1},
          ],
        },
      ],
    });
    expect(encoded.subarray(dataStart)).toEqual(Buffer.concat(blocks));
    expect(blocks[0]?.length).toBeGreaterThan(
      `${JSON.stringify(first)}\n`.length,
    );
  });

  it('preserves prototype-like unknown fields through both schemas', () => {
    const text = JSON.stringify(translationFile([])).replace(
      '"schemaVersion":1',
      '"schemaVersion":1,"__proto__":{"kept":true},"constructor":"kept"',
    );
    const encoded = encodeChunkedBible(Buffer.from(text), 'invented.llbible');
    const header = parseBibleChunkHeader(encoded.subarray(4), 0, 'sample');
    expect(Object.hasOwn(header, '__proto__')).toBe(true);
    expect(header).toHaveProperty('constructor', 'kept');
    expect(Object.getPrototypeOf(header)).toBe(Object.prototype);
  });

  it('supports an empty translation without adding body bytes', () => {
    const encoded = encode(translationFile([]));
    expect(encoded.length).toBe(4 + encoded.readUInt32LE());
  });

  it.each([
    {...translationFile(), format: 'other'},
    {...translationFile(), schemaVersion: 2},
    {...translationFile(), language: 'invalid_tag'},
    {...translationFile(), books: [{id: 43, chapters: [['Invented']]}]},
    {...translationFile(), books: [{id: 57, chapters: [[' untrimmed ']]}]},
    {...translationFile(), books: [{id: 57, chapters: [['x'.repeat(20_001)]]}]},
    {...translationFile(), books: [{id: 57, chapters: [[]]}]},
    {
      ...translationFile(),
      books: [{id: 57, chapters: [Array<string>(40_001).fill('')]}],
    },
    {
      ...translationFile(),
      books: [{id: 57, chapters: [Array<string>(200).fill('x'.repeat(6000))]}],
    },
    {...translationFile([]), future: 'x'.repeat(BIBLE_HEADER_MAX_BYTES)},
  ])('rejects invalid source data and container limits %#', value => {
    expect(() => encode(value)).toThrow();
  });

  it('rejects malformed JSON and invalid UTF-8 instead of changing source text', () => {
    for (const bytes of [Buffer.from('{'), Buffer.from([0xff])]) {
      expect(() => encodeChunkedBible(bytes, 'invented.llbible')).toThrow();
    }
  });
});
