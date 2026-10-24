import {describe, expectTypeOf, it} from 'vitest';
import {
  parseShortcuts,
  serializeShortcuts,
  type ShortcutsFile,
} from './shortcuts';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseShortcuts, serialize: serializeShortcuts};

function changedShortcuts() {
  return {
    format: 'llsettings.shortcuts',
    schemaVersion: 1,
    bindings: {
      'output.toggle': [['Ctrl', '1']],
      'clear.all': [['F1'], ['Shift', 'Escape']],
      'slide.next': [],
      'future.command': [['Alt', 'X']],
    },
  };
}

describe('parseShortcuts', () => {
  it('reads changed, removed, and unknown commands', () => {
    expectRoundTrip(codec, changedShortcuts());
  });

  it('reads a file with no changes', () => {
    expectRoundTrip(codec, {...changedShortcuts(), bindings: {}});
  });

  it.each([
    ['an empty combination', {'clear.all': [[]]}, 'bindings.clear.all.0'],
    ['bindings that are an array', [], 'bindings'],
    ['a blank key', {'clear.all': [['Ctrl', ' ']]}, 'bindings.clear.all.0.1'],
    [
      'a combination that is text',
      {'clear.all': ['F1']},
      'bindings.clear.all.0',
    ],
  ])('rejects %s', (_name, bindings, field) => {
    expectInvalidField(codec, {...changedShortcuts(), bindings}, field);
  });
});

describe('shortcut types', () => {
  it('keeps the command ids as a record', () => {
    expectTypeOf<ShortcutsFile['bindings']>().toEqualTypeOf<
      Readonly<Record<string, ReadonlyArray<readonly string[]>>>
    >();
  });
});
