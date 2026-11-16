import {describe, it} from 'vitest';
import {parseLabels, serializeLabels} from '@core/schema/labels';
import {
  expectInvalidField,
  expectRoundTrip,
} from '@fixtures/core/schema/testHelpers';

const codec = {parse: parseLabels, serialize: serializeLabels};

function defaultLabels() {
  return {
    format: 'llsettings.labels',
    schemaVersion: 1,
    labels: [
      {name: '전주', color: '#7D8FD6', key: null},
      {name: '1절', color: '#5FB8C2', key: null},
      {name: '2절', color: '#5FB8C2', key: null},
      {name: '3절', color: '#5FB8C2', key: null},
      {name: '4절', color: '#5FB8C2', key: null},
      {name: '프리코러스', color: '#8FBF7A', key: null},
      {name: '후렴', color: '#D6B35F', key: null},
      {name: '포스트코러스', color: '#D68F5F', key: null},
      {name: '브리지', color: '#A99AE0', key: null},
      {name: '간주', color: '#A3A3A3', key: null},
      {name: '후주', color: '#7D8FD6', key: null},
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

  it.each(['#5FB8C2', '#00ff7f', '#000000', '#FFFFFF', 'none'])(
    'accepts the stored color %s',
    color => {
      expectRoundTrip(codec, withLabel({name: '1절', color, key: null}));
    },
  );

  it.each(['teal', '#5FB8C', '#5FB8C22', '#GG0000', 'transparent', 17])(
    'rejects the stored color %s',
    color => {
      expectInvalidField(
        codec,
        withLabel({name: '1절', color, key: null}),
        'labels.0.color',
      );
    },
  );

  it('keeps unknown fields in a label', () => {
    expectRoundTrip(
      codec,
      withLabel({name: '1절', color: '#5FB8C2', key: 'Digit1', shape: 'pill'}),
    );
  });

  it.each([
    ['a blank name', {name: ' ', color: '#5FB8C2', key: null}, 'labels.0.name'],
    [
      'a color outside the palette',
      {name: '1절', color: 'red', key: null},
      'labels.0.color',
    ],
  ])('rejects %s', (_name, label, field) => {
    expectInvalidField(codec, withLabel(label), field);
  });

  it('rejects two labels with the same name', () => {
    const labels = {
      ...defaultLabels(),
      labels: [
        {name: '후렴', color: '#D6B35F', key: null},
        {name: '후렴', color: '#D07A8A', key: null},
      ],
    };

    expectInvalidField(codec, labels, 'labels.1');
  });
});
