import {describe, expect, it} from 'vitest';
import {
  BIBLE_CHAPTER_MAX_BYTES,
  BIBLE_HEADER_MAX_BYTES,
  parseBibleChapter,
  parseBibleChunkHeader,
} from './chunkFormat';
import {chunkedTranslationFile, translationFile} from './testFiles';

function parse(header: unknown, bodyBytes: number, id = 'sample') {
  return parseBibleChunkHeader(
    Buffer.from(JSON.stringify(header)),
    bodyBytes,
    id,
  );
}

describe('chunked Bible header validation', () => {
  it('accepts canonical partial books and retains unknown metadata', () => {
    const fixture = chunkedTranslationFile(translationFile([43, 57]));
    const header = {
      ...fixture.header,
      extension: {retained: true},
      source: {...fixture.header.source, future: 'retained'},
      books: fixture.header.books.map(book => ({...book, future: true})),
    };
    expect(parse(header, fixture.bytes.length - fixture.dataStart)).toEqual(
      header,
    );
  });

  it('accepts an empty catalog only with an empty body', () => {
    const {header} = chunkedTranslationFile(translationFile([]));
    expect(parse(header, 0).books).toEqual([]);
    expect(() => parse(header, 1)).toThrow();
  });

  it('preserves prototype-like unknown keys as own data properties', () => {
    const {header} = chunkedTranslationFile(translationFile([]));
    const text = JSON.stringify(header).replace(
      '"schemaVersion":2',
      '"schemaVersion":2,"__proto__":{"retained":true},"constructor":"retained"',
    );
    const parsed = parseBibleChunkHeader(Buffer.from(text), 0, 'sample');
    expect(Object.hasOwn(parsed, '__proto__')).toBe(true);
    expect(parsed).toHaveProperty('constructor', 'retained');
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  it.each([
    ['format', 'other'],
    ['schemaVersion', 1],
    ['schemaVersion', 3],
    ['id', 'UPPERCASE'],
    ['id', 'another'],
    ['name', ' '],
    ['shortName', ''],
    ['language', 'not_a_tag'],
    ['source', {}],
    ['source', {...translationFile().source, url: 'file:///untrusted'}],
    ['source', {...translationFile().source, retrieved: '2026-02-30'}],
  ])('rejects invalid metadata %s = %j', (key, value) => {
    const {header, blocks} = chunkedTranslationFile(translationFile([57]));
    expect(() =>
      parse({...header, [key]: value}, Buffer.concat(blocks).length),
    ).toThrow();
  });

  it.each(
    [
      [{id: 57, chapters: []}],
      [{id: 43, chapters: [{offset: 0, bytes: 8, verses: 1}]}],
      [{id: 67, chapters: [{offset: 0, bytes: 8, verses: 1}]}],
      [
        {id: 57, chapters: [{offset: 0, bytes: 4, verses: 1}]},
        {id: 57, chapters: [{offset: 4, bytes: 4, verses: 1}]},
      ],
      [
        {id: 65, chapters: [{offset: 0, bytes: 4, verses: 1}]},
        {id: 57, chapters: [{offset: 4, bytes: 4, verses: 1}]},
      ],
    ].map(books => ({books})),
  )('rejects invalid book tables %#', ({books}) => {
    const {header} = chunkedTranslationFile(translationFile([]));
    expect(() => parse({...header, books}, 8)).toThrow();
  });

  it.each([
    {offset: -1},
    {offset: 1},
    {offset: 0.5},
    {offset: Number.MAX_SAFE_INTEGER + 1},
    {bytes: 0},
    {bytes: -1},
    {bytes: 1.5},
    {bytes: BIBLE_CHAPTER_MAX_BYTES + 1},
    {verses: 0},
    {verses: 1.5},
    {verses: 40_001},
  ])('rejects invalid chapter entries %j', update => {
    const {header} = chunkedTranslationFile(translationFile([]));
    const chapters = [{offset: 0, bytes: 8, verses: 1, ...update}];
    expect(() => parse({...header, books: [{id: 57, chapters}]}, 8)).toThrow();
  });

  it('rejects gaps, overlaps, truncated spans and trailing bytes', () => {
    const {header, blocks} = chunkedTranslationFile(translationFile([57, 65]));
    const bodyBytes = Buffer.concat(blocks).length;
    for (const delta of [-1, 1]) {
      const books = header.books.map((book, index) => ({
        ...book,
        chapters: book.chapters.map(entry => ({
          ...entry,
          offset: entry.offset + (index === 1 ? delta : 0),
        })),
      }));
      expect(() => parse({...header, books}, bodyBytes)).toThrow();
      expect(() => parse(header, bodyBytes + delta)).toThrow();
    }
    for (const size of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parse(header, size)).toThrow();
    }
  });

  it('rejects oversized, malformed, BOM-prefixed and non-UTF-8 JSON headers', () => {
    for (const bytes of [
      Buffer.alloc(0),
      Buffer.alloc(BIBLE_HEADER_MAX_BYTES + 1),
      Buffer.from('{'),
      Buffer.from('\uFEFF{}'),
      Buffer.from([0xff]),
    ]) {
      expect(() => parseBibleChunkHeader(bytes, 0, 'sample')).toThrow();
    }
  });
});

describe('Bible chapter block validation', () => {
  it('preserves Unicode and omitted verse slots without editing text', () => {
    const verses = [
      'Invented \uAC00\uB098 sentence.',
      '',
      'Invented \u{1f680} sentence.',
    ];
    const bytes = Buffer.from(`${JSON.stringify(verses)}\n`);
    const result = parseBibleChapter(bytes, {
      offset: 0,
      bytes: bytes.length,
      verses: 3,
    });
    expect(result).toEqual(verses);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    ['["Invented"]', 1],
    ['["Invented"]\r', 1],
    ['["Invented"]\n', 2],
    ['[1]\n', 1],
    ['[" untrimmed"]\n', 1],
    ['["untrimmed "]\n', 1],
    ['{}\n', 1],
    ['{\n', 1],
    ['\uFEFF["Invented"]\n', 1],
    [`["${'x'.repeat(20_001)}"]\n`, 1],
  ])('rejects invalid chapter block %#', (text, verses) => {
    const bytes = Buffer.from(text);
    expect(() =>
      parseBibleChapter(bytes, {offset: 0, bytes: bytes.length, verses}),
    ).toThrow();
  });

  it('rejects wrong byte lengths and invalid UTF-8 without replacement characters', () => {
    const bytes = Buffer.from([91, 34, 255, 34, 93, 10]);
    for (const length of [bytes.length, bytes.length + 1]) {
      expect(() =>
        parseBibleChapter(bytes, {offset: 0, bytes: length, verses: 1}),
      ).toThrow();
    }
  });
});
