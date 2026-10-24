import {describe, expect, expectTypeOf, it} from 'vitest';
import {
  parseShortcuts,
  serializeShortcuts,
  type KeyBinding,
  type KeyModifier,
} from './shortcuts';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
} from './testHelpers';

const codec = {parse: parseShortcuts, serialize: serializeShortcuts};
const LOOK_COMMAND = 'look.5d2f0c52-7e1f-4a2b-8c3d-4e5f60718293';

function changedShortcuts() {
  return {
    format: 'llsettings.shortcuts',
    schemaVersion: 1,
    bindings: {
      'output.audience': [{code: 'Digit1', mods: ['ctrl']}],
      [LOOK_COMMAND]: [{code: 'Digit2', mods: ['alt']}],
      'clear.all': [
        {code: 'F1', mods: []},
        {code: 'Escape', mods: ['shift']},
      ],
      'show.next': [],
      'future.command': [{code: 'KeyX', mods: ['ctrl', 'alt', 'shift']}],
    },
  };
}

function load(bindings: object) {
  return expectSuccess(
    parseShortcuts(
      JSON.stringify({...changedShortcuts(), bindings}),
      'shortcuts.json',
    ),
  );
}

describe('parseShortcuts', () => {
  it('reads physical keys, removed keys, and unknown commands', () => {
    expectRoundTrip(codec, changedShortcuts());
    expect(load(changedShortcuts().bindings).dropped).toEqual([]);
  });

  it('reads a file with no changes', () => {
    expectRoundTrip(codec, {...changedShortcuts(), bindings: {}});
  });

  it('keeps unknown fields in a binding', () => {
    expectRoundTrip(codec, {
      ...changedShortcuts(),
      bindings: {'clear.all': [{code: 'F1', mods: [], side: 'left'}]},
    });
  });

  it.each([
    ['a display name instead of a code', {code: 'Ctrl', mods: []}, '0.code'],
    ['an empty code', {code: '', mods: []}, '0.code'],
    ['a Hangul key name', {code: 'ㅊ', mods: []}, '0.code'],
    ['an unknown modifier', {code: 'Digit1', mods: ['meta']}, '0.mods.0'],
    [
      'modifiers out of order',
      {code: 'Digit1', mods: ['shift', 'ctrl']},
      '0.mods',
    ],
    ['a repeated modifier', {code: 'Digit1', mods: ['ctrl', 'ctrl']}, '0.mods'],
    ['a bare letter', {code: 'KeyC', mods: []}, '0'],
    ['a bare digit', {code: 'Digit1', mods: []}, '0'],
    ['a bare numpad digit', {code: 'Numpad1', mods: []}, '0'],
    ['the old display-name form', ['Ctrl', '1'], '0'],
  ])('drops a binding with %s and keeps the others', (_name, key, path) => {
    const loaded = load({
      'output.audience': [key],
      'output.stage': [{code: 'Digit2', mods: ['ctrl']}],
    });

    expect(loaded.data.bindings).toEqual({
      'output.stage': [{code: 'Digit2', mods: ['ctrl']}],
    });
    expect(loaded.dropped.map(({field}) => field)).toEqual([
      `bindings.output.audience.${path}`,
    ]);
    expect(loaded.dropped[0]?.message).not.toBe('');
  });

  it.each([
    ['Tab', {code: 'Tab', mods: []}],
    ['Shift Tab', {code: 'Tab', mods: ['shift']}],
    ['Esc alone', {code: 'Escape', mods: []}],
    ['Enter alone', {code: 'Enter', mods: []}],
    ['Ctrl C', {code: 'KeyC', mods: ['ctrl']}],
    ['Alt F4', {code: 'F4', mods: ['alt']}],
    ['Ctrl Alt Delete', {code: 'Delete', mods: ['ctrl', 'alt']}],
    ['Print Screen with any modifier', {code: 'PrintScreen', mods: ['shift']}],
    ['the Menu key', {code: 'ContextMenu', mods: []}],
  ])('drops a binding to the reserved key %s', (_name, key) => {
    const loaded = load({
      'clear.all': [{code: 'F1', mods: []}, key],
      'output.stage': [{code: 'Digit2', mods: ['ctrl']}],
    });

    expect(loaded.data.bindings).toEqual({
      'output.stage': [{code: 'Digit2', mods: ['ctrl']}],
    });
    expect(loaded.dropped.map(({field}) => field)).toEqual([
      'bindings.clear.all.1',
    ]);
  });

  it('keeps keys next to reserved ones', () => {
    expect(
      load({
        'a.b': [{code: 'Escape', mods: ['shift']}],
        'c.d': [{code: 'KeyC', mods: ['ctrl', 'shift']}],
        'e.f': [{code: 'Enter', mods: ['ctrl']}],
      }).dropped,
    ).toEqual([]);
  });

  it('drops a binding list that is not a list', () => {
    const loaded = load({'clear.all': {code: 'F1', mods: []}});

    expect(loaded.data.bindings).toEqual({});
    expect(loaded.dropped.map(({field}) => field)).toEqual([
      'bindings.clear.all',
    ]);
  });

  it('drops a blank command id', () => {
    const loaded = load({' ': [{code: 'F1', mods: []}], 'clear.all': []});

    expect(loaded.data.bindings).toEqual({'clear.all': []});
    expect(loaded.dropped.map(({field}) => field)).toEqual(['bindings. ']);
  });

  it('accepts a letter with only shift, and keys that are not characters', () => {
    expect(
      load({
        'a.b': [{code: 'KeyC', mods: ['shift']}],
        'c.d': [{code: 'PageDown', mods: []}],
        'e.f': [{code: 'ArrowRight', mods: []}],
      }).dropped,
    ).toEqual([]);
  });

  it('still rejects bindings that are not an object', () => {
    expectInvalidField(
      codec,
      {...changedShortcuts(), bindings: []},
      'bindings',
    );
  });

  it('refuses to write a bare letter', () => {
    const shortcuts = load({}).data;

    const written = serializeShortcuts(
      {...shortcuts, bindings: {'a.b': [{code: 'KeyC', mods: []}]}},
      'shortcuts.json',
    );

    expect(written.ok).toBe(false);
  });
});

describe('writing reserved keys', () => {
  it.each([
    ['Tab', {code: 'Tab', mods: []}],
    ['Ctrl V', {code: 'KeyV', mods: ['ctrl']}],
    ['Print Screen with any modifier', {code: 'PrintScreen', mods: ['alt']}],
  ] as const)('refuses to write the reserved key %s', (_name, key) => {
    const shortcuts = load({}).data;

    const written = serializeShortcuts(
      {...shortcuts, bindings: {'clear.all': [{code: 'F1', mods: []}, key]}},
      'shortcuts.json',
    );

    expect(written.ok ? null : written.error.field).toBe(
      'bindings.clear.all.1',
    );
  });
});

describe('shortcut types', () => {
  it('stores the physical key and the modifiers', () => {
    expectTypeOf<KeyBinding>().toEqualTypeOf<{
      readonly code: string;
      readonly mods: readonly KeyModifier[];
    }>();
    expectTypeOf<KeyModifier>().toEqualTypeOf<'ctrl' | 'alt' | 'shift'>();
  });
});
