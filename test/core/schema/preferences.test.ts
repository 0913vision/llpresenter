import {describe, expect, it} from 'vitest';
import {
  AUDIO_DEVICE_LIMIT,
  DEFAULT_AUDIO_DEVICE,
  defaultPreferences,
  parsePreferences,
  parsePreferencesValue,
  serializePreferences,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
} from '@fixtures/core/schema/testHelpers';

const codec = {parse: parsePreferences, serialize: serializePreferences};
const HEADER = {format: 'llsettings.preferences', schemaVersion: 1} as const;

function parse(json: unknown) {
  return expectSuccess(
    parsePreferences(JSON.stringify(json), 'preferences.json'),
  ).data;
}

describe('parsePreferences', () => {
  it('defaults Bible review on and round-trips an explicit false without dropping unknown fields', () => {
    expect(
      withPreferenceDefaults(parse(HEADER)).bible.splitEditorAutoOpen,
    ).toBe(true);
    const stored = {
      ...HEADER,
      bible: {splitEditorAutoOpen: false, future: 'keep'},
    };
    expectRoundTrip(codec, stored);
    expect(
      withPreferenceDefaults(parse(stored)).bible.splitEditorAutoOpen,
    ).toBe(false);
    expectInvalidField(
      codec,
      {...HEADER, bible: {splitEditorAutoOpen: 'false'}},
      'bible.splitEditorAutoOpen',
    );
  });
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
    ['366 kept backups', {backup: {auto: false, keep: 366}}, 'backup.keep'],
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
      backup: {keep: defaultPreferences.backup.keep},
    });
  });

  it('accepts both ends of every range', () => {
    for (const ends of [
      {
        backupCopies: 3,
        backup: {keep: 1},
      },
      {
        backupCopies: 50,
        backup: {keep: 365},
      },
    ]) {
      const loaded = expectSuccess(
        parsePreferences(JSON.stringify({...HEADER, ...ends}), 'p.json'),
      );

      expect(loaded.dropped).toEqual([]);
      expect(loaded.data).toMatchObject(ends);
    }
  });

  it('keeps unknown fields named like Object members, at every level', () => {
    const json: unknown = JSON.parse(
      JSON.stringify({
        ...HEADER,
        constructor: 'root',
        toString: 1,
        backup: {keep: 5, constructor: true, hasOwnProperty: 'x'},
        bible: {maxLines: 4, toString: ['a'], valueOf: null},
      }).replace('"toString":1', '"toString":1,"__proto__":{"a":1}'),
    );

    expectRoundTrip(codec, json);
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
  it.each([
    [{}, 'stop'],
    [{show: {}}, 'stop'],
    [{show: {atLastSlide: 'stop'}}, 'stop'],
    [{show: {atLastSlide: 'nextItem'}}, 'nextItem'],
  ] as const)(
    'defaults what next does on the last slide to stop: %j',
    (fields, expected) => {
      const stored = parse({...HEADER, ...fields});
      expect(withPreferenceDefaults(stored).show.atLastSlide).toBe(expected);
    },
  );

  it('preserves unknown show fields in storage and after normalization', () => {
    const config = {...HEADER, show: {future: {enabled: true}}};
    expectRoundTrip(codec, config);
    expect(withPreferenceDefaults(parse(config))).toMatchObject({
      show: {atLastSlide: 'stop', future: {enabled: true}},
    });
  });

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

describe('preferences read boundary', () => {
  it('keeps unknown media fields', () => {
    const value = {...HEADER, media: {future: {enabled: true}}};
    expectRoundTrip(codec, value);
    expect(expectSuccess(parsePreferencesValue(value)).media).toMatchObject(
      value.media,
    );
    expect(
      withPreferenceDefaults(parse({...HEADER, media: {future: 'invented'}})),
    ).toHaveProperty('media', expect.objectContaining({future: 'invented'}));
  });
  it('defaults launching with Windows off and keeps an explicit choice and unknown general fields', () => {
    expect(
      expectSuccess(parsePreferencesValue(HEADER)).general.launchAtLogin,
    ).toBe(false);
    const value = {...HEADER, general: {launchAtLogin: true, future: 1}};
    expectRoundTrip(codec, value);
    expect(expectSuccess(parsePreferencesValue(value)).general).toMatchObject(
      value.general,
    );
    expect(
      parsePreferencesValue({...HEADER, general: {launchAtLogin: 'yes'}}).ok,
    ).toBe(false);
  });

  it('defaults the new media choices to 반복, 채우기, and sound off and fills the missing ones', () => {
    expect(expectSuccess(parsePreferencesValue(HEADER)).media.defaults).toEqual(
      {end: 'loop', fit: 'fill', audio: false},
    );
    const value = {...HEADER, media: {defaults: {fit: 'stretch', audio: true}}};
    expectRoundTrip(codec, value);
    expect(expectSuccess(parsePreferencesValue(value)).media.defaults).toEqual({
      end: 'loop',
      fit: 'stretch',
      audio: true,
    });
  });

  it.each([{end: 'pause'}, {fit: 'crop'}, {audio: 'on'}])(
    'rejects a new media choice that is not one of its choices: %j',
    defaults => {
      expect(parsePreferencesValue({...HEADER, media: {defaults}}).ok).toBe(
        false,
      );
    },
  );

  it('returns a normalized value for a valid sparse file-shaped reply', () => {
    expect(expectSuccess(parsePreferencesValue(HEADER))).toEqual(
      defaultPreferences,
    );
  });

  it.each([
    null,
    [],
    {},
    {...HEADER, show: []},
    {...HEADER, show: {atLastSlide: 'next'}},
    {...HEADER, show: {atLastSlide: true}},
    {...HEADER, show: {atLastSlide: null}},
  ])('rejects malformed preferences %j', value => {
    expect(parsePreferencesValue(value).ok).toBe(false);
  });
});

describe('audio output choices', () => {
  const DEVICE = {id: 'hall-1', label: 'Mixer (USB)'};

  it('starts both choices on the Windows default device', () => {
    const preferences = expectSuccess(parsePreferencesValue(HEADER));
    expect(preferences.media.audioOutput).toEqual(DEFAULT_AUDIO_DEVICE);
    expect(preferences.media.previewOutput).toEqual(DEFAULT_AUDIO_DEVICE);
    expect(DEFAULT_AUDIO_DEVICE).toEqual({id: '', label: ''});
  });

  it('keeps both stored choices and unknown fields', () => {
    const value = {
      ...HEADER,
      media: {
        audioOutput: DEVICE,
        previewOutput: {id: '', label: 'Windows 기본 장치'},
        future: 1,
      },
    };
    expectRoundTrip(codec, value);
    expect(expectSuccess(parsePreferencesValue(value)).media).toMatchObject(
      value.media,
    );
  });

  it('fills the other choice with its default when only one is stored', () => {
    const media = expectSuccess(
      parsePreferencesValue({...HEADER, media: {audioOutput: DEVICE}}),
    ).media;
    expect(media.audioOutput).toEqual(DEVICE);
    expect(media.previewOutput).toEqual(DEFAULT_AUDIO_DEVICE);
  });

  it('accepts an id and a label up to the cap', () => {
    const long = 'x'.repeat(AUDIO_DEVICE_LIMIT);
    expectRoundTrip(codec, {
      ...HEADER,
      media: {audioOutput: {id: long, label: long}},
    });
  });

  it.each([
    [
      'an id over the cap',
      {id: 'x'.repeat(AUDIO_DEVICE_LIMIT + 1), label: 'a'},
      'id',
    ],
    [
      'a label over the cap',
      {id: 'a', label: 'x'.repeat(AUDIO_DEVICE_LIMIT + 1)},
      'label',
    ],
    ['a choice without a label', {id: 'a'}, 'label'],
    ['an id that is not text', {id: 3, label: 'a'}, 'id'],
  ])('rejects %s', (_name, audioOutput, field) => {
    expectInvalidField(
      codec,
      {...HEADER, media: {audioOutput}},
      `media.audioOutput.${field}`,
    );
  });
});

describe('전환 settings', () => {
  it('defaults to a short dissolve between items and none within', () => {
    const {transition} = expectSuccess(parsePreferencesValue(HEADER)).output;
    expect(transition.between).toEqual({kind: 'dissolve', sec: 0.5});
    expect(transition.within).toEqual({kind: 'none', sec: 0.2});
    expect(transition.media).toEqual({kind: 'dissolve', seconds: 0.5});
  });
  it('round-trips independent defaults and unknown fields', () => {
    expectRoundTrip(codec, {
      ...HEADER,
      output: {
        transition: {
          between: {kind: 'wipe', dir: 'up', sec: 4, future: 1},
          within: {kind: 'push', dir: 'right', sec: 0.1},
          media: {kind: 'none', seconds: 3},
        },
      },
    });
  });
  it.each(['between', 'within'])('refuses invalid %s defaults', part => {
    expectInvalidField(
      codec,
      {
        ...HEADER,
        output: {
          transition: {
            [part]: {kind: 'zoom', sec: 1},
          },
        },
      },
      `output.transition.${part}.kind`,
    );
    expect(
      serializePreferences(
        {
          ...HEADER,
          output: {
            transition: {
              [part]: {kind: 'dissolve', sec: 10.1},
            },
          },
        },
        'preferences.json',
      ).ok,
    ).toBe(false);
  });
  it('keeps background range recovery', () => {
    const stored = parse({
      ...HEADER,
      output: {transition: {media: {kind: 'none', seconds: 10}}},
    });
    expect(withPreferenceDefaults(stored).output.transition.media).toEqual({
      kind: 'none',
      seconds: 0.5,
    });
  });
});

describe('오디오 times', () => {
  it('starts at 0.5 s and 3 s', () => {
    expect(expectSuccess(parsePreferencesValue(HEADER)).show.audio).toEqual({
      transitionSeconds: 0.5,
      fadeOutSeconds: 3,
    });
  });

  it.each([
    ['transitionSeconds', 0],
    ['transitionSeconds', 5],
    ['fadeOutSeconds', 0.5],
    ['fadeOutSeconds', 10],
  ])('accepts %s %s and keeps unknown fields', (key, seconds) => {
    expectRoundTrip(codec, {
      ...HEADER,
      show: {audio: {[key]: seconds, future: 1}},
    });
  });

  it.each([
    ['transitionSeconds', -0.1, 0.5],
    ['transitionSeconds', 5.1, 0.5],
    ['fadeOutSeconds', 0.4, 3],
    ['fadeOutSeconds', 10.5, 3],
  ])('drops %s %s on read and falls back to %s', (key, seconds, fallback) => {
    const loaded = parse({...HEADER, show: {audio: {[key]: seconds}}});
    expect(
      withPreferenceDefaults(loaded).show.audio[
        key === 'transitionSeconds' ? 'transitionSeconds' : 'fadeOutSeconds'
      ],
    ).toBe(fallback);
  });

  it('refuses to write a time out of range', () => {
    const written = serializePreferences(
      {
        ...defaultPreferences,
        show: {audio: {fadeOutSeconds: 11}},
      },
      'preferences.json',
    );
    expect(written.ok).toBe(false);
  });
});

describe('the fields 환경설정 no longer has', () => {
  const REMOVED = [
    'language',
    'onLaunch',
    'hardwareAcceleration',
    'previewFps',
    'preventSleep',
    'alwaysOnTop',
    'onDisconnect',
  ] as const;

  it('leaves them out of the defaults and out of a read file', () => {
    for (const name of REMOVED) {
      expect(defaultPreferences).not.toHaveProperty(name);
      expect(defaultPreferences.show).not.toHaveProperty(name);
    }
    expect(defaultPreferences.bible).not.toHaveProperty('maxLines');
    expect(defaultPreferences.show).not.toHaveProperty('showClearUndoButton');
    expect(withPreferenceDefaults(parse(HEADER))).toEqual(defaultPreferences);
  });

  it('no longer checks a value stored under a removed name', () => {
    const loaded = expectSuccess(
      parsePreferences(
        JSON.stringify({...HEADER, language: 'en', previewFps: 24}),
        'p.json',
      ),
    );
    expect(loaded.dropped).toEqual([]);
  });
});

describe('성경 새 구절 defaults', () => {
  it('start as a verse each, the reference on every slide, verse numbers on, no translation name', () => {
    expect(expectSuccess(parsePreferencesValue(HEADER)).bible.defaults).toEqual(
      {
        split: 'verse',
        reference: 'every',
        verseNumbers: true,
        translationName: false,
      },
    );
  });

  it('keeps stored defaults, fills the rest, and keeps unknown fields', () => {
    const value = {
      ...HEADER,
      bible: {
        defaults: {split: 'fit', reference: 'last', future: 1},
      },
    };
    expectRoundTrip(codec, value);
    const bible = expectSuccess(parsePreferencesValue(value)).bible;
    expect(bible.defaults).toEqual({
      split: 'fit',
      reference: 'last',
      verseNumbers: true,
      translationName: false,
      future: 1,
    });
  });

  it.each([
    ['split', 'three'],
    ['reference', 'middle'],
    ['verseNumbers', 'yes'],
    ['translationName', 1],
  ])('refuses %s %j', (key, value) => {
    expectInvalidField(
      codec,
      {...HEADER, bible: {defaults: {[key]: value}}},
      `bible.defaults.${key}`,
    );
  });
});
