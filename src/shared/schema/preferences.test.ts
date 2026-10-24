import {describe, expect, it} from 'vitest';
import {
  defaultPreferences,
  parsePreferences,
  serializePreferences,
  withPreferenceDefaults,
} from './preferences';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
} from './testHelpers';

const codec = {parse: parsePreferences, serialize: serializePreferences};
const HEADER = {format: 'llsettings.preferences', schemaVersion: 1};

function parse(json: unknown) {
  return expectSuccess(
    parsePreferences(JSON.stringify(json), 'preferences.json'),
  ).data;
}

describe('parsePreferences', () => {
  it('reads a file with only the header', () => {
    expectRoundTrip(codec, HEADER);
  });

  it('writes and reads back the full defaults', () => {
    const text = expectSuccess(
      serializePreferences(defaultPreferences, 'preferences.json'),
    );

    expect(parse(JSON.parse(text))).toEqual(defaultPreferences);
  });

  it('keeps unknown fields at every level', () => {
    expectRoundTrip(codec, {
      ...HEADER,
      theme: 'dark',
      backup: {auto: false, location: 'E:'},
      import: {txt: {split: 'symbol', symbol: '#'}, pptx: {notes: true}},
    });
  });

  it.each([
    ['a language without a translation', {language: 'en'}, 'language'],
    ['a backup group that is an array', {backup: []}, 'backup'],
    [
      'an unlisted source position',
      {bible: {sourcePosition: 'topLeft'}},
      'bible.sourcePosition',
    ],
    [
      'an unknown text encoding',
      {import: {txt: {encoding: 'euc-kr'}}},
      'import.txt.encoding',
    ],
  ])('rejects %s', (_name, change, field) => {
    expectInvalidField(codec, {...HEADER, ...change}, field);
  });
});

describe('the ranges of 환경설정', () => {
  it.each([
    ['zero recovery copies', {backupCopies: 0}, 'backupCopies'],
    ['51 recovery copies', {backupCopies: 51}, 'backupCopies'],
    ['a frame rate that is text', {previewFps: '30'}, 'previewFps'],
    ['a frame rate the previews lack', {previewFps: 24}, 'previewFps'],
    ['366 kept backups', {backup: {auto: false, keep: 366}}, 'backup.keep'],
    ['13 lines per 장', {bible: {maxLines: 13}}, 'bible.maxLines'],
  ])('drops %s alone and keeps the rest', (_name, change, field) => {
    const loaded = expectSuccess(
      parsePreferences(
        JSON.stringify({...HEADER, showOnLaunch: true, ...change}),
        'preferences.json',
      ),
    );

    expect(loaded.dropped).toEqual([expect.objectContaining({field})]);
    expect(loaded.data.showOnLaunch).toBe(true);
    expect(withPreferenceDefaults(loaded.data)).toMatchObject({
      backupCopies: defaultPreferences.backupCopies,
      previewFps: defaultPreferences.previewFps,
      backup: {keep: defaultPreferences.backup.keep},
      bible: {maxLines: defaultPreferences.bible.maxLines},
    });
  });

  it('accepts both ends of every range', () => {
    for (const ends of [
      {
        backupCopies: 3,
        previewFps: 15,
        backup: {keep: 1},
        bible: {maxLines: 1},
      },
      {
        backupCopies: 50,
        previewFps: 60,
        backup: {keep: 365},
        bible: {maxLines: 12},
      },
    ]) {
      const loaded = expectSuccess(
        parsePreferences(JSON.stringify({...HEADER, ...ends}), 'p.json'),
      );

      expect(loaded.dropped).toEqual([]);
      expect(loaded.data).toMatchObject(ends);
    }
  });

  it('refuses to write a count outside its range', () => {
    const written = serializePreferences(
      {...defaultPreferences, backupCopies: 51},
      'preferences.json',
    );

    expect(written.ok ? null : written.error.field).toBe('backupCopies');
  });
});

describe('withPreferenceDefaults', () => {
  it('fills a file with only the header with every default', () => {
    expect(withPreferenceDefaults(parse(HEADER))).toEqual(defaultPreferences);
  });

  it('keeps stored values and fills the rest of each group', () => {
    const stored = parse({
      ...HEADER,
      showOnLaunch: true,
      backup: {keep: 5},
      import: {txt: {firstLine: 'lyrics'}},
    });

    const preferences = withPreferenceDefaults(stored);

    expect(preferences.showOnLaunch).toBe(true);
    expect(preferences.backup).toEqual({auto: true, keep: 5});
    expect(preferences.import.txt).toEqual({
      ...defaultPreferences.import.txt,
      firstLine: 'lyrics',
    });
    expect(preferences.bible).toEqual(defaultPreferences.bible);
  });

  it('keeps unknown fields of the stored file', () => {
    const stored = parse({...HEADER, theme: 'dark', import: {pptx: {a: 1}}});

    expect(withPreferenceDefaults(stored)).toMatchObject({
      theme: 'dark',
      import: {pptx: {a: 1}},
    });
  });
});
