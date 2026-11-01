import {describe, expect, it} from 'vitest';
import {
  fillMessageText,
  MAX_MESSAGE_CHARACTERS,
} from '@core/overlays/messageText';

describe('fillMessageText', () => {
  it('requires own blank values instead of inherited object properties', () => {
    expect(() => fillMessageText({text: '{toString}'}, {})).toThrow(
      'Missing message value: toString',
    );
    expect(fillMessageText({text: '{toString}'}, {toString: 'Own value'})).toBe(
      'Own value',
    );
  });

  it('uses literal values, replaces repeated blanks, and rejects missing or blank values', () => {
    expect(fillMessageText({text: '{name}, {name}'}, {name: '$&'})).toBe(
      '$&, $&',
    );
    expect(() => fillMessageText({text: 'Invented {name}'}, {})).toThrow(
      'Missing message value',
    );
    expect(() =>
      fillMessageText({text: 'Invented {name}'}, {name: '  '}),
    ).toThrow('Missing message value');
  });

  it('refuses oversized templates and expansion before producing an unbounded result', () => {
    const longName = 'field'.repeat(20);
    expect(
      fillMessageText(
        {text: `{name}{${longName}}`},
        {name: 'x'.repeat(MAX_MESSAGE_CHARACTERS - 1), [longName]: 'y'},
      ),
    ).toHaveLength(MAX_MESSAGE_CHARACTERS);
    expect(
      fillMessageText({text: 'x'.repeat(MAX_MESSAGE_CHARACTERS)}, {}),
    ).toHaveLength(MAX_MESSAGE_CHARACTERS);
    expect(() =>
      fillMessageText({text: 'x'.repeat(MAX_MESSAGE_CHARACTERS + 1)}, {}),
    ).toThrow('too long');
    expect(() =>
      fillMessageText(
        {text: '{name}{name}'},
        {name: 'x'.repeat(MAX_MESSAGE_CHARACTERS)},
      ),
    ).toThrow('too long');
  });
});
