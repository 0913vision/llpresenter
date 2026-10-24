import {describe, expectTypeOf, it} from 'vitest';
import type {LabelColor} from '../colors';
import {parseLabels, serializeLabels, type Label} from './labels';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

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
      {name: '후렴', color: 'yellow', key: 'C'},
      {name: '브리지', color: 'violet', key: null},
      {name: '간주', color: 'gray', key: null},
      {name: '엔딩', color: 'none', key: null},
    ],
  };
}

function withLabel(label: object) {
  return {...defaultLabels(), labels: [label]};
}

describe('parseLabels', () => {
  it('reads the default 이름표 list', () => {
    expectRoundTrip(codec, defaultLabels());
  });

  it('keeps unknown fields in a label', () => {
    expectRoundTrip(
      codec,
      withLabel({name: '1절', color: 'teal', key: '1', shape: 'pill'}),
    );
  });

  it.each([
    ['a blank name', {name: ' ', color: 'teal', key: null}, 'labels.0.name'],
    [
      'a color outside the palette',
      {name: '1절', color: 'red', key: null},
      'labels.0.color',
    ],
    ['no key field', {name: '1절', color: 'teal'}, 'labels.0.key'],
    ['an empty key', {name: '1절', color: 'teal', key: ''}, 'labels.0.key'],
  ])('rejects %s', (_name, label, field) => {
    expectInvalidField(codec, withLabel(label), field);
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
