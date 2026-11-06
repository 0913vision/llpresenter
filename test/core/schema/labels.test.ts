import {describe, expect, it} from 'vitest';
import {parseLabels, serializeLabels} from '@core/schema/labels';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
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
            {name: '후렴', color: '#D6B35F', key},
            {name: '1절', color: '#5FB8C2', key: 'Digit1'},
          ]),
        ),
        'labels.json',
      ),
    );

    expect(loaded.data.labels).toEqual([
      {name: '후렴', color: '#D6B35F', key: null},
      {name: '1절', color: '#5FB8C2', key: 'Digit1'},
    ]);
    expect(loaded.dropped.map(({field}) => field)).toEqual(['labels.0.key']);
    expect(loaded.dropped[0]?.message).not.toBe('');
  });

  it('gives a label without a key field no jump key', () => {
    const loaded = expectSuccess(
      parseLabels(
        JSON.stringify(withLabel({name: '1절', color: '#5FB8C2'})),
        'labels.json',
      ),
    );

    expect(loaded.data.labels).toEqual([
      {name: '1절', color: '#5FB8C2', key: null},
    ]);
    expect(loaded.dropped.map(({field}) => field)).toEqual(['labels.0.key']);
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

describe('serializeLabels', () => {
  it('refuses to write an invalid jump key instead of turning it into none', () => {
    const labels = expectSuccess(
      parseLabels(JSON.stringify(defaultLabels()), 'labels.json'),
    ).data;

    const written = serializeLabels(
      {...labels, labels: [{name: '후렴', color: '#D6B35F', key: 'C'}]},
      'labels.json',
    );

    expect(written.ok ? undefined : written.error.field).toBe('labels.0.key');
  });
});
