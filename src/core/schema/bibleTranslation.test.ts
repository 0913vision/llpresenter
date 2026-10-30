import {describe, expect, it} from 'vitest';
import {parseBibleTranslation} from './bibleTranslation';
import {expectSuccess} from './testHelpers';

const file = 'example.llbible';
const sample = {
  format: 'llbible',
  schemaVersion: 1,
  id: 'example',
  name: 'Example translation',
  shortName: 'Example',
  language: 'ko',
  source: {
    title: 'Invented test sentences',
    publisher: 'Test fixture',
    url: 'https://example.com/text',
    license: 'Invented for tests',
    retrieved: '2026-10-25',
  },
  books: [
    {id: 1, chapters: [['첫째 예시 문장', '', '다음 예시 문장']]},
    {id: 66, chapters: [['Last invented sentence']]},
  ],
};

function parse(value: unknown) {
  return parseBibleTranslation(JSON.stringify(value), file);
}

describe('Bible translation files', () => {
  it('accepts partial translations with omitted verses and preserves text exactly', () => {
    const value = {
      ...sample,
      books: [
        {id: 2, chapters: [['  Preserve spacing  ', '', 'No renumbering']]},
      ],
    };
    expect(expectSuccess(parse(value))).toMatchObject({
      data: value,
      access: 'editable',
      sourceVersion: 1,
    });
    expect(expectSuccess(parse({...sample, books: []})).data.books).toEqual([]);
  });

  it('retains unknown fields at every object level, including reserved keys', () => {
    const value = {
      ...sample,
      future: true,
      source: {...sample.source, future: {mode: 1}},
      books: [{id: 1, chapters: [['Invented sentence']], future: ['kept']}],
    };
    expect(expectSuccess(parse(value)).data).toEqual(value);
    const reserved: unknown = JSON.parse(
      JSON.stringify(value).replace(
        '"future":true',
        '"__proto__":{"safe":true}',
      ),
    );
    expect(expectSuccess(parse(reserved)).data).toEqual(reserved);
  });

  it.each([
    'ko',
    'en-US',
    'zh-Hant-TW',
    'zh-cmn-Hans-CN',
    'es-419',
    'de-CH-1901',
    'x-private',
    'i-klingon',
    'en-a-example-x-own',
  ])('accepts BCP 47 tag %s unchanged', language => {
    expect(expectSuccess(parse({...sample, language})).data.language).toBe(
      language,
    );
  });

  it.each([
    '',
    'ko_KR',
    'en-',
    'en--US',
    'en-a',
    'en-a-one-a-two',
    'sl-rozaj-rozaj',
    '\u212Ao',
    'ko\n',
  ])('rejects malformed language tag %j', language => {
    expect(parse({...sample, language})).toMatchObject({
      ok: false,
      error: {file, field: 'language'},
    });
  });

  it.each([
    [{...sample, id: 'UPPER'}, 'id'],
    [{...sample, id: '  '}, 'id'],
    [{...sample, name: ''}, 'name'],
    [{...sample, shortName: ''}, 'shortName'],
    [
      {...sample, source: {...sample.source, retrieved: '2025-02-29'}},
      'source.retrieved',
    ],
    [
      {...sample, source: {...sample.source, retrieved: '2026-2-5'}},
      'source.retrieved',
    ],
    [{...sample, source: {...sample.source, url: 'not a URL'}}, 'source.url'],
    [
      {...sample, source: {...sample.source, url: 'ftp://example.com/text'}},
      'source.url',
    ],
    [{...sample, books: [{id: 0, chapters: [['Text']]}]}, 'books.0.id'],
    [{...sample, books: [{id: 67, chapters: [['Text']]}]}, 'books.0.id'],
    [{...sample, books: [{id: 1.5, chapters: [['Text']]}]}, 'books.0.id'],
    [{...sample, books: [{id: 1, chapters: [[]]}]}, 'books.0.chapters.0'],
    [{...sample, books: [{id: 1, chapters: []}]}, 'books.0.chapters'],
    [{...sample, books: [{id: 1, chapters: [[5]]}]}, 'books.0.chapters.0.0'],
    [{...sample, books: [{id: 1, chapters: ['Text']}]}, 'books.0.chapters.0'],
    [
      {
        ...sample,
        books: [
          {id: 2, chapters: [['Text']]},
          {id: 1, chapters: [['Text']]},
        ],
      },
      'books.1',
    ],
    [
      {
        ...sample,
        books: [
          {id: 1, chapters: [['Text']]},
          {id: 1, chapters: [['Text']]},
        ],
      },
      'books.1',
    ],
  ])('rejects invalid structure %j at %s', (value, field) => {
    expect(parse(value)).toMatchObject({ok: false, error: {file, field}});
  });

  it('accepts leap dates and leaves chapter-count checks to main metadata', () => {
    const value = {
      ...sample,
      source: {...sample.source, retrieved: '2024-02-29'},
      books: [{id: 1, chapters: [['Invented sentence']]}],
    };
    expect(expectSuccess(parse(value)).data).toEqual(value);
  });

  it('uses common format, version, malformed JSON, and newer-version handling', () => {
    expect(parse({...sample, format: 'llsettings.bible'})).toMatchObject({
      ok: false,
      error: {kind: 'format', file},
    });
    expect(parse({...sample, schemaVersion: 0}).ok).toBe(false);
    expect(parseBibleTranslation('{broken', file)).toMatchObject({
      ok: false,
      error: {kind: 'json', file},
    });
    expect(expectSuccess(parse({...sample, schemaVersion: 2}))).toMatchObject({
      access: 'readOnly',
      sourceVersion: 2,
    });
    expect(parse({...sample, schemaVersion: 2, books: [false]})).toMatchObject({
      ok: false,
      error: {kind: 'newer', file},
    });
  });
});
