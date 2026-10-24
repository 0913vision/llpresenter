import {describe, expectTypeOf, it} from 'vitest';
import {parseBible, serializeBible, type Translation} from './bible';
import type {TranslationId} from './ids';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseBible, serialize: serializeBible};

function bibleFile() {
  return {
    format: 'llsettings.bible',
    schemaVersion: 1,
    translations: [
      {
        id: 'krv',
        name: '개역한글',
        lang: '한국어',
        file: 'krv.json',
        default: true,
      },
      {
        id: 'kjv',
        name: 'KJV',
        lang: 'English',
        file: 'kjv.json',
        default: false,
      },
    ],
    recents: [
      {ref: '요한복음 3:16-18', translation: 'krv'},
      {ref: 'John 3:16', translation: 'kjv'},
    ],
  };
}

describe('parseBible', () => {
  it('reads the bundled translations and recent passages', () => {
    expectRoundTrip(codec, bibleFile());
  });

  it('keeps unknown fields in translations and recents', () => {
    const file = bibleFile();
    expectRoundTrip(codec, {
      ...file,
      translations: file.translations.map(translation => ({
        ...translation,
        version: '1961',
      })),
      recents: [{ref: '시편 23:1', translation: 'krv', pinned: true}],
    });
  });

  it.each([
    [
      'a blank translation name',
      {translations: [{...bibleFile().translations[0], name: ''}]},
      'translations.0.name',
    ],
    [
      'no translation file',
      {
        translations: [
          {id: 'krv', name: '개역한글', lang: '한국어', default: true},
        ],
      },
      'translations.0.file',
    ],
    [
      'a recent without a translation',
      {recents: [{ref: '시편 23:1'}]},
      'recents.0.translation',
    ],
  ])('rejects %s', (_name, change, field) => {
    expectInvalidField(codec, {...bibleFile(), ...change}, field);
  });

  it.each([
    ['in a folder', 'sub/krv.llbible'],
    ['in a Windows folder', 'sub\\krv.llbible'],
    ['a step up', '../krv.llbible'],
    ['with an absolute path', 'C:\\bible\\krv.llbible'],
    ['with a drive name', 'C:krv.llbible'],
    ['named after the folder itself', '.'],
    ['named after the folder above', '..'],
  ])('rejects a translation file %s', (_name, file) => {
    const [krv] = bibleFile().translations;

    expectInvalidField(
      codec,
      {...bibleFile(), translations: [{...krv, file}]},
      'translations.0.file',
    );
  });

  it('rejects two translations with the same id', () => {
    const [krv] = bibleFile().translations;

    expectInvalidField(
      codec,
      {...bibleFile(), translations: [krv, {...krv, name: '사본'}]},
      'translations.1',
    );
  });
});

describe('bible types', () => {
  it('brands translation ids', () => {
    expectTypeOf<Translation['id']>().toEqualTypeOf<TranslationId>();
  });
});
