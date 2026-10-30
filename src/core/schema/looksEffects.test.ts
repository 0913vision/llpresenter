import {expect, it} from 'vitest';
import {parseLooks, serializeLooks} from './looks';
import {expectFailure, expectSuccess} from './testHelpers';

const id = '11111111-1111-4111-8111-111111111111';
const fixture = {
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
      outline: {on: false, width: 3, color: '#000000'},
      shadow: {
        on: true,
        blur: 8,
        distance: 4,
        angle: 45,
        opacity: 60,
        color: '#000000',
      },
      referencePosition: 'bottomRight',
      futureStyle: {retained: 7},
    },
  ],
  futureRoot: ['retained'],
};

it.each(['bottomRight', 'bottomLeft', 'afterLastLine', 'hidden'] as const)(
  'round-trips the reference position %s',
  position => {
    const current = expectSuccess(
      parseLooks(JSON.stringify(fixture), 'looks'),
    ).data;
    const changed = {
      ...current,
      lyricStyles: current.lyricStyles.map(style => ({
        ...style,
        referencePosition: position,
      })),
    };
    const text = expectSuccess(serializeLooks(changed, 'looks'));
    expect(expectSuccess(parseLooks(text, 'looks')).data).toEqual(changed);
  },
);

it('rejects an unknown reference position', () => {
  const current = expectSuccess(
    parseLooks(JSON.stringify(fixture), 'looks'),
  ).data;
  const bad = {
    ...current,
    lyricStyles: current.lyricStyles.map(style => ({
      ...style,
      referencePosition: 'middle',
    })),
  };
  expect(expectFailure(parseLooks(JSON.stringify(bad), 'looks')).field).toBe(
    'lyricStyles.0.referencePosition',
  );
});

it('preserves custom fields and parameters even when effects are off', () => {
  const current = expectSuccess(
    parseLooks(JSON.stringify(fixture), 'looks'),
  ).data;
  const input = {
    ...current,
    lyricStyles: current.lyricStyles.map(style => ({
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
  const written = expectSuccess(serializeLooks(input, 'looks'));
  expect(expectSuccess(parseLooks(written, 'looks')).data).toEqual(input);
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
  const current = expectSuccess(
    parseLooks(JSON.stringify(fixture), 'looks'),
  ).data;
  const bad = {
    ...current,
    lyricStyles: current.lyricStyles.map(style => ({...style, [key]: value})),
  };
  expect(expectFailure(parseLooks(JSON.stringify(bad), 'looks')).kind).toBe(
    'invalid',
  );
});

it('validates the rest of the current style and the file header', () => {
  const current = expectSuccess(
    parseLooks(JSON.stringify(fixture), 'looks'),
  ).data;
  const bad = {
    ...current,
    lyricStyles: current.lyricStyles.map(style => ({...style, font: ''})),
  };
  expect(expectFailure(parseLooks(JSON.stringify(bad), 'looks')).field).toBe(
    'lyricStyles.0.font',
  );
  expect(
    expectFailure(
      parseLooks(JSON.stringify({...current, current: 'bad'}), 'looks'),
    ).field,
  ).toBe('current');
});

it('opens a compatible newer format read-only and refuses a newer-version write', () => {
  const current = expectSuccess(
    parseLooks(JSON.stringify(fixture), 'looks'),
  ).data;
  const newer = {...current, schemaVersion: 2};
  expect(expectSuccess(parseLooks(JSON.stringify(newer), 'looks')).access).toBe(
    'readOnly',
  );
  expect(serializeLooks({...current, schemaVersion: 2}, 'looks').ok).toBe(
    false,
  );
});
