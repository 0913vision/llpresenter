import {describe, expect, it} from 'vitest';
import {serializeShortcuts} from '@core/schema/shortcuts';
import {shortcutNames, shortcutPress} from './shortcutKeys';

describe('shortcut keys', () => {
  it('stores only schema-valid combinations across supported key families', () => {
    const codes = [
      'KeyA',
      'KeyC',
      'KeyV',
      'KeyX',
      'KeyZ',
      'Digit1',
      'Numpad1',
      'ArrowRight',
      'Space',
      'Enter',
      'Tab',
      'Escape',
      'Backspace',
      'F1',
      'F4',
      'F10',
      'F24',
      'ContextMenu',
      'PrintScreen',
      'Delete',
      'Equal',
      'Minus',
      'BracketLeft',
      'NumpadAdd',
      'NumpadEnter',
      'MediaStop',
    ];
    for (const code of codes) {
      for (let flags = 0; flags < 8; flags++) {
        const press = shortcutPress(
          new KeyboardEvent('keydown', {
            code,
            ctrlKey: (flags & 1) !== 0,
            altKey: (flags & 2) !== 0,
            shiftKey: (flags & 4) !== 0,
          }),
        );
        if (press.kind !== 'record') continue;
        expect(
          serializeShortcuts(
            {
              format: 'llsettings.shortcuts',
              schemaVersion: 1,
              bindings: {test: [press.binding]},
            },
            'shortcuts.json',
          ).ok,
          `${code} with flags ${flags}`,
        ).toBe(true);
      }
    }
  });

  it.each([
    ['KeyC', 'C'],
    ['Digit1', '1'],
    ['ArrowLeft', '←'],
    ['ArrowRight', '→'],
    ['ArrowUp', '↑'],
    ['ArrowDown', '↓'],
    ['PageUp', 'Page Up'],
    ['PageDown', 'Page Down'],
    ['Escape', 'Esc'],
    ['ContextMenu', 'Menu'],
    ['Minus', '-'],
    ['Equal', '='],
    ['NumpadAdd', 'Num +'],
    ['NumpadEnter', 'Num Enter'],
    ['F12', 'F12'],
  ])('names physical %s as %s', (code, name) => {
    expect(shortcutNames({code, mods: []})).toEqual([name]);
  });
});
