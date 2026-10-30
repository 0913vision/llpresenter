import {expect, it} from 'vitest';
import * as v from 'valibot';
import {screenIdSchema} from './ids';
import {
  DEFAULT_MESSAGE_STYLE,
  MESSAGE_STYLE_LIMIT,
  messageStyleForScreen,
  parseLooks,
  serializeLooks,
} from './looks';
import {expectFailure, expectSuccess} from './testHelpers';

const id = '11111111-1111-4111-8111-111111111111';
const screenA = v.parse(screenIdSchema, '22222222-2222-4222-8222-222222222222');
const screenB = v.parse(screenIdSchema, '33333333-3333-4333-8333-333333333333');
const styleId = '44444444-4444-4444-8444-444444444444';
const file = {
  format: 'llsettings.looks',
  schemaVersion: 1,
  current: id,
  looks: [
    {
      id,
      name: 'Invented',
      screens: {
        [screenA]: {layers: {message: true}},
        [screenB]: {layers: {message: true}},
      },
    },
  ],
  lyricStyles: [],
};

it('uses the existing message appearance when no style is selected', () => {
  const loaded = expectSuccess(parseLooks(JSON.stringify(file), 'looks')).data;
  const screen = loaded.looks[0]?.screens[screenA];
  expect(screen).toBeDefined();
  if (!screen) throw new Error('Missing screen');
  expect(messageStyleForScreen(loaded, screen)).toEqual(DEFAULT_MESSAGE_STYLE);
  expect(expectSuccess(serializeLooks(loaded, 'looks'))).toContain('Invented');
});

it('round-trips a per-screen choice and resolves missing styles safely', () => {
  const style = {
    ...DEFAULT_MESSAGE_STYLE,
    id: styleId,
    name: 'Invented style',
    size: 64,
    background: {color: '#123456', opacity: 50},
    future: 7,
  };
  const input = {
    ...file,
    schemaVersion: 1,
    messageStyles: [style],
    looks: [
      {
        ...file.looks[0],
        screens: {
          [screenA]: {layers: {message: true}, messageStyle: styleId},
          [screenB]: {layers: {message: true}},
        },
      },
    ],
  };
  const loaded = expectSuccess(parseLooks(JSON.stringify(input), 'looks')).data;
  const first = loaded.looks[0]?.screens[screenA];
  const second = loaded.looks[0]?.screens[screenB];
  if (!first || !second) throw new Error('Missing screen');
  expect(messageStyleForScreen(loaded, first)).toMatchObject(style);
  expect(messageStyleForScreen(loaded, second)).toEqual(DEFAULT_MESSAGE_STYLE);
  expect(messageStyleForScreen({...loaded, messageStyles: []}, first)).toEqual(
    DEFAULT_MESSAGE_STYLE,
  );
  expect(JSON.parse(expectSuccess(serializeLooks(loaded, 'looks')))).toEqual(
    input,
  );
});

it('rejects invalid style fields, references, duplicates, and oversized lists', () => {
  const parse = (value: unknown) => parseLooks(JSON.stringify(value), 'looks');
  const current = {...file, schemaVersion: 1};
  expect(
    expectFailure(
      parse({
        ...current,
        messageStyles: [{...DEFAULT_MESSAGE_STYLE, id: styleId, size: 0}],
      }),
    ).kind,
  ).toBe('invalid');
  expect(
    expectFailure(
      parse({
        ...current,
        messageStyles: [
          {
            ...DEFAULT_MESSAGE_STYLE,
            id: styleId,
            background: {color: '#123456', opacity: 101},
          },
        ],
      }),
    ).kind,
  ).toBe('invalid');
  expect(
    expectFailure(
      parse({
        ...current,
        looks: [
          {
            ...file.looks[0],
            screens: {[screenA]: {layers: {}, messageStyle: 'bad'}},
          },
        ],
      }),
    ).kind,
  ).toBe('invalid');
  expect(
    expectFailure(
      parse({
        ...current,
        messageStyles: [{...DEFAULT_MESSAGE_STYLE}, {...DEFAULT_MESSAGE_STYLE}],
      }),
    ).kind,
  ).toBe('invalid');
  const many = Array.from({length: MESSAGE_STYLE_LIMIT + 1}, (_, n) => ({
    ...DEFAULT_MESSAGE_STYLE,
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  }));
  expect(expectFailure(parse({...current, messageStyles: many})).kind).toBe(
    'invalid',
  );
});
