import {expect, it} from 'vitest';
import {
  DEFAULT_MESSAGE_STYLE,
  MESSAGE_STYLE_LIMIT,
  parseMessages,
  serializeMessages,
} from '@core/schema/messages';
import {expectFailure, expectSuccess} from '@fixtures/core/schema/testHelpers';

const styleId = '44444444-4444-4444-8444-444444444444';
const file = {
  format: 'llsettings.messages',
  schemaVersion: 1,
  templates: [],
  stagePresets: [],
};

const parse = (value: unknown) =>
  parseMessages(JSON.stringify(value), 'messages');

it('reads a messages file that has no styles', () => {
  const loaded = expectSuccess(parse(file)).data;
  expect(loaded.messageStyles).toBeUndefined();
});

it('round-trips styles with their background and unknown fields', () => {
  const style = {
    ...DEFAULT_MESSAGE_STYLE,
    id: styleId,
    name: 'Invented style',
    size: 64,
    background: {color: '#123456', opacity: 50},
    future: 7,
  };
  const input = {...file, messageStyles: [style]};
  const loaded = expectSuccess(parse(input)).data;
  expect(loaded.messageStyles?.[0]).toMatchObject(style);
  expect(
    JSON.parse(expectSuccess(serializeMessages(loaded, 'messages'))),
  ).toEqual(input);
});

it('rejects invalid style fields, duplicates, and oversized lists', () => {
  for (const messageStyles of [
    [{...DEFAULT_MESSAGE_STYLE, id: styleId, size: 0}],
    [
      {
        ...DEFAULT_MESSAGE_STYLE,
        id: styleId,
        background: {color: '#123456', opacity: 101},
      },
    ],
    [{...DEFAULT_MESSAGE_STYLE}, {...DEFAULT_MESSAGE_STYLE}],
    Array.from({length: MESSAGE_STYLE_LIMIT + 1}, (_, n) => ({
      ...DEFAULT_MESSAGE_STYLE,
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    })),
  ]) {
    expect(expectFailure(parse({...file, messageStyles})).kind).toBe('invalid');
  }
});
