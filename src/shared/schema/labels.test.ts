import {describe, expect, expectTypeOf, it} from 'vitest';
import type {LabelColor} from '../colors';
import {parseLabels, serializeLabels, type Label} from './labels';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
} from './testHelpers';

const codec = {parse: parseLabels, serialize: serializeLabels};

function defaultLabels() {
  return {
    format: 'llsettings.labels',
    schemaVersion: 1,
    labels: [
      {name: '1절', color: 'teal', key: null},
      {name: '2절', color: 'teal', key: null},
      {name: '3절', color: 'teal', key: null},
      {name: '프리코러스', color: 'green', key: null},
      {name: '후렴', color: 'yellow', key: 'KeyC'},
      {name: '브리지', color: 'violet', key: null},
      {name: '간주', color: 'gray', key: null},
      {name: '엔딩', color: 'none', key: null},
    ],
  };
}

function withLabel(label: object) {
  return withLabelList([label]);
}

function withLabelList(labels: readonly object[]) {
  return {...defaultLabels(), labels};
}

describe('parseLabels', () => {
  it('reads the default 이름표 list', () => {
    expectRoundTrip(codec, defaultLabels());
  });

  it('keeps unknown fields in a label', () => {
    expectRoundTrip(
      codec,
      withLabel({name: '1절', color: 'teal', key: 'Digit1', shape: 'pill'}),
    );
  });

  it.each([
    ['a blank name', {name: ' ', color: 'teal', key: null}, 'labels.0.name'],
    [
      'a color outside the palette',
      {name: '1절', color: 'red', key: null},
      'labels.0.color',
    ],
  ])('rejects %s', (_name, label, field) => {
    expectInvalidField(codec, withLabel(label), field);
  });

  it.each([
    ['a character instead of a code', 'C'],
    ['a digit character', '1'],
    ['an empty key', ''],
    ['a key that is not a letter or digit', 'F5'],
    ['a numpad digit', 'Numpad1'],
    ['a lowercase code', 'keyc'],
    ['a number', 1],
  ])('drops only the jump key when it is %s', (_name, key) => {
    const loaded = expectSuccess(
      parseLabels(
        JSON.stringify(
          withLabelList([
            {name: '후렴', color: 'yellow', key},
            {name: '1절', color: 'teal', key: 'Digit1'},
          ]),
        ),
        'labels.json',
      ),
    );

    expect(loaded.data.labels).toEqual([
      {name: '후렴', color: 'yellow', key: null},
      {name: '1절', color: 'teal', key: 'Digit1'},
    ]);
    expect(loaded.dropped.map(({field}) => field)).toEqual(['labels.0.key']);
    expect(loaded.dropped[0]?.message).not.toBe('');
  });

  it('gives a label without a key field no jump key', () => {
    const loaded = expectSuccess(
      parseLabels(
        JSON.stringify(withLabel({name: '1절', color: 'teal'})),
        'labels.json',
      ),
    );

    expect(loaded.data.labels).toEqual([
      {name: '1절', color: 'teal', key: null},
    ]);
    expect(loaded.dropped.map(({field}) => field)).toEqual(['labels.0.key']);
  });

  it('rejects two labels with the same name', () => {
    const labels = {
      ...defaultLabels(),
      labels: [
        {name: '후렴', color: 'yellow', key: null},
        {name: '후렴', color: 'rose', key: null},
      ],
    };

    expectInvalidField(codec, labels, 'labels.1');
  });
});

describe('label types', () => {
  it('uses the shared label colors', () => {
    expectTypeOf<Label['color']>().toEqualTypeOf<LabelColor>();
    expectTypeOf<Label['key']>().toEqualTypeOf<string | null>();
  });
});
