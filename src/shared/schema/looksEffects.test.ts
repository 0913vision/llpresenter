import {expect, it} from 'vitest';
import {parseLooksEffects, serializeLooksEffects} from './looksEffects';
import {expectFailure, expectSuccess} from './testHelpers';

const id = '11111111-1111-4111-8111-111111111111';
const old = {
  format: 'llsettings.looks',
  schemaVersion: 1,
  current: id,
  looks: [{id, name: 'Invented', screens: {}, futureLook: true}],
  lyricStyles: [
    {
      id,
      name: 'Invented',
      font: 'Pretendard',
      weight: 700,
      size: 84,
      color: '#FFFFFF',
      align: 'center',
      vAlign: 'middle',
      lineHeight: 1.4,
      maxLines: 2,
      margin: 6,
      outline: false,
      shadow: true,
      futureStyle: {retained: 7},
    },
  ],
  futureRoot: ['retained'],
};

it('migrates switches without losing their state or unknown fields', () => {
  const result = expectSuccess(parseLooksEffects(JSON.stringify(old), 'looks'));
  expect(result.sourceVersion).toBe(1);
  expect(result.data).toMatchObject({
    schemaVersion: 2,
    futureRoot: ['retained'],
    lyricStyles: [
      {
        futureStyle: {retained: 7},
        outline: {on: false, width: 3, color: '#000000'},
        referencePosition: 'bottomRight',
        shadow: {
          on: true,
          blur: 8,
          distance: 4,
          angle: 45,
          opacity: 60,
          color: '#000000',
        },
      },
    ],
  });
  const written = expectSuccess(serializeLooksEffects(result.data, 'looks'));
  expect(expectSuccess(parseLooksEffects(written, 'looks')).data).toEqual(
    result.data,
  );
});

it.each(['bottomRight', 'bottomLeft', 'afterLastLine', 'hidden'] as const)(
  'round-trips the reference position %s',
  position => {
    const current = expectSuccess(
      parseLooksEffects(JSON.stringify(old), 'looks'),
    ).data;
    const changed = {
      ...current,
      lyricStyles: current.lyricStyles.map(style => ({
        ...style,
        referencePosition: position,
      })),
    };
    const text = expectSuccess(serializeLooksEffects(changed, 'looks'));
    expect(expectSuccess(parseLooksEffects(text, 'looks')).data).toEqual(
      changed,
    );
  },
);

it('preserves a legacy extension that collides with the new reference field', () => {
  const input = {
    ...old,
    lyricStyles: [
      {
        ...old.lyricStyles[0],
        referencePosition: {old: true},
        legacyV1: {other: 7},
      },
    ],
  };
  const loaded = expectSuccess(
    parseLooksEffects(JSON.stringify(input), 'looks'),
  );
  expect(loaded.data.lyricStyles[0]).toMatchObject({
    referencePosition: 'bottomRight',
    legacyV1: {referencePosition: {old: true}, legacyV1: {other: 7}},
  });
});

it('rejects an unknown reference position', () => {
  const current = expectSuccess(
    parseLooksEffects(JSON.stringify(old), 'looks'),
  ).data;
  const bad = {
    ...current,
    lyricStyles: current.lyricStyles.map(style => ({
      ...style,
      referencePosition: 'middle',
    })),
  };
  expect(
    expectFailure(parseLooksEffects(JSON.stringify(bad), 'looks')).field,
  ).toBe('lyricStyles.0.referencePosition');
});

it.each([
  [true, true],
  [true, false],
  [false, true],
  [false, false],
])('keeps legacy outline=%s and shadow=%s', (outline, shadow) => {
  const file = {
    ...old,
    lyricStyles: [{...old.lyricStyles[0], outline, shadow}],
  };
  const loaded = expectSuccess(
    parseLooksEffects(JSON.stringify(file), 'looks'),
  );
  expect(loaded.data.lyricStyles[0]?.outline.on).toBe(outline);
  expect(loaded.data.lyricStyles[0]?.shadow.on).toBe(shadow);
});

it('preserves custom fields and parameters even when effects are off', () => {
  const migrated = expectSuccess(
    parseLooksEffects(JSON.stringify(old), 'looks'),
  ).data;
  const input = {
    ...migrated,
    lyricStyles: migrated.lyricStyles.map(style => ({
      ...style,
      outline: {on: false, width: 10, color: '#ABCDEF', future: 'x'},
      shadow: {
        on: false,
        blur: 40,
        distance: 20,
        angle: 360,
        opacity: 100,
        color: '#123456',
        future: true,
      },
    })),
  };
  const written = expectSuccess(serializeLooksEffects(input, 'looks'));
  expect(expectSuccess(parseLooksEffects(written, 'looks')).data).toEqual(
    input,
  );
});

it.each([
  ['outline', {on: true, width: 0, color: '#000000'}],
  ['outline', {on: true, width: 11, color: '#000000'}],
  ['outline', {on: true, width: 3, color: 'black'}],
  ['outline', {on: 'yes', width: 3, color: '#000000'}],
  [
    'shadow',
    {on: true, blur: 41, distance: 4, angle: 45, opacity: 60, color: '#000000'},
  ],
  [
    'shadow',
    {on: true, blur: 8, distance: -1, angle: 45, opacity: 60, color: '#000000'},
  ],
  [
    'shadow',
    {on: true, blur: 8, distance: 21, angle: 45, opacity: 60, color: '#000000'},
  ],
  [
    'shadow',
    {on: true, blur: -1, distance: 4, angle: 45, opacity: 60, color: '#000000'},
  ],
  [
    'shadow',
    {on: true, blur: 8, distance: 4, angle: -1, opacity: 60, color: '#000000'},
  ],
  [
    'shadow',
    {on: true, blur: 8, distance: 4, angle: 361, opacity: 60, color: '#000000'},
  ],
  [
    'shadow',
    {on: true, blur: 8, distance: 4, angle: 45, opacity: 101, color: '#000000'},
  ],
])('rejects invalid %s parameters', (key, value) => {
  const migrated = expectSuccess(
    parseLooksEffects(JSON.stringify(old), 'looks'),
  ).data;
  const bad = {
    ...migrated,
    lyricStyles: migrated.lyricStyles.map(style => ({...style, [key]: value})),
  };
  expect(
    expectFailure(parseLooksEffects(JSON.stringify(bad), 'looks')).kind,
  ).toBe('invalid');
});

it('rejects a malformed old switch instead of silently migrating it', () => {
  const bad = {...old, lyricStyles: [{...old.lyricStyles[0], shadow: 'yes'}]};
  expect(
    expectFailure(parseLooksEffects(JSON.stringify(bad), 'looks')).kind,
  ).toBe('migration');
});

it('validates the rest of the current style and the file header', () => {
  const current = expectSuccess(
    parseLooksEffects(JSON.stringify(old), 'looks'),
  ).data;
  const bad = {
    ...current,
    lyricStyles: current.lyricStyles.map(style => ({...style, font: ''})),
  };
  expect(
    expectFailure(parseLooksEffects(JSON.stringify(bad), 'looks')).field,
  ).toBe('lyricStyles.0.font');
  expect(
    expectFailure(
      parseLooksEffects(JSON.stringify({...current, current: 'bad'}), 'looks'),
    ).field,
  ).toBe('current');
});

it('opens a compatible newer format read-only and refuses an old-version write', () => {
  const current = expectSuccess(
    parseLooksEffects(JSON.stringify(old), 'looks'),
  ).data;
  const newer = {...current, schemaVersion: 3};
  expect(
    expectSuccess(parseLooksEffects(JSON.stringify(newer), 'looks')).access,
  ).toBe('readOnly');
  expect(
    serializeLooksEffects({...current, schemaVersion: 1}, 'looks').ok,
  ).toBe(false);
});
