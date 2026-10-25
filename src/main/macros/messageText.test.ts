import {describe, expect, it} from 'vitest';
import {fillMacroMessage, MAX_MACRO_MESSAGE_CHARACTERS} from './messageText';
import {environment} from './testing';

describe('macro message rendering', () => {
  it('uses literal values, replaces repeated blanks, and rejects missing or blank values', () => {
    const {catalog} = environment();
    const template = catalog.messages.templates[0];
    if (template === undefined) throw new Error('No template');
    expect(
      fillMacroMessage({...template, text: '{name}, {name}'}, {name: '$&'}),
    ).toBe('$&, $&');
    expect(() => fillMacroMessage(template, {})).toThrow(
      'Missing message value',
    );
    expect(() => fillMacroMessage(template, {name: '  '})).toThrow(
      'Missing message value',
    );
  });

  it('refuses oversized templates and expansion before producing an unbounded result', () => {
    const {catalog} = environment();
    const template = catalog.messages.templates[0];
    if (template === undefined) throw new Error('No template');
    const longName = 'field'.repeat(20);
    expect(
      fillMacroMessage(
        {...template, text: `{name}{${longName}}`},
        {name: 'x'.repeat(MAX_MACRO_MESSAGE_CHARACTERS - 1), [longName]: 'y'},
      ),
    ).toHaveLength(MAX_MACRO_MESSAGE_CHARACTERS);
    expect(
      fillMacroMessage(
        {...template, text: 'x'.repeat(MAX_MACRO_MESSAGE_CHARACTERS)},
        {},
      ),
    ).toHaveLength(MAX_MACRO_MESSAGE_CHARACTERS);
    expect(() =>
      fillMacroMessage(
        {...template, text: 'x'.repeat(MAX_MACRO_MESSAGE_CHARACTERS + 1)},
        {},
      ),
    ).toThrow('too long');
    expect(() =>
      fillMacroMessage(
        {...template, text: '{name}{name}'},
        {name: 'x'.repeat(MAX_MACRO_MESSAGE_CHARACTERS)},
      ),
    ).toThrow('too long');
  });
});
