import {describe, expect, it} from 'vitest';
import {serializeShortcuts} from '@core/schema/shortcuts';
import {shortcutNames, shortcutPress} from '@core/shortcuts/keys';
import type {PhysicalKeyPress} from '@core/shortcuts/matching';

interface PressOptions {
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  readonly metaKey?: boolean;
  readonly isComposing?: boolean;
  readonly numLock?: boolean;
}

function press(code: string, options: PressOptions = {}): PhysicalKeyPress {
  const {numLock = false, ...keys} = options;
  return {
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    isComposing: false,
    repeat: false,
    getModifierState: key => key === 'NumLock' && numLock,
    ...keys,
  };
}

describe('shortcutPress', () => {
  it('records the physical code with the modifiers in canonical order', () => {
    expect(
      shortcutPress(
        press('KeyC', {shiftKey: true, altKey: true, ctrlKey: true}),
      ),
    ).toEqual({
      kind: 'record',
      binding: {code: 'KeyC', mods: ['ctrl', 'alt', 'shift']},
    });
  });

  it.each<[string, PressOptions, string]>([
    ['Enter', {}, '확인과 실행에 쓰는 키'],
    ['NumpadEnter', {}, '확인과 실행에 쓰는 키'],
    ['F10', {}, '메뉴 막대에 쓰는 키'],
    ['F10', {shiftKey: true}, '오른쪽 클릭 메뉴에 쓰는 키'],
    ['ContextMenu', {}, '오른쪽 클릭 메뉴에 쓰는 키'],
    ...['KeyX', 'KeyC', 'KeyV', 'KeyA'].map<[string, PressOptions, string]>(
      code => [code, {ctrlKey: true}, '글자 편집에 쓰는 키'],
    ),
    ['F4', {altKey: true}, 'Windows가 쓰는 키'],
    ['Tab', {altKey: true}, 'Windows가 쓰는 키'],
    ['Escape', {ctrlKey: true}, 'Windows가 쓰는 키'],
    ['Delete', {ctrlKey: true, altKey: true}, 'Windows가 쓰는 키'],
    ['KeyD', {metaKey: true}, 'Windows가 쓰는 키'],
    ['PrintScreen', {}, 'Windows가 쓰는 키'],
    ['', {}, '입력기에 쓰는 키'],
    ['Lang1', {}, '입력기에 쓰는 키'],
    ['Lang2', {}, '입력기에 쓰는 키'],
    ['KeyC', {isComposing: true, ctrlKey: true}, '입력기에 쓰는 키'],
    ['KeyC', {}, '슬라이드 바로 가기에 쓰는 키'],
    ['Digit1', {}, '슬라이드 바로 가기에 쓰는 키'],
    ['Numpad1', {}, '슬라이드 바로 가기에 쓰는 키'],
    ['Unidentified', {}, '지원하지 않는 키'],
  ])('rejects %s %j and says why', (code, options, reason) => {
    expect(shortcutPress(press(code, options))).toEqual({
      kind: 'reject',
      reason,
    });
  });
});

describe('shortcutNames', () => {
  it.each<[string, PressOptions, string]>([
    ['KeyC', {ctrlKey: true, altKey: true, shiftKey: true}, 'Ctrl Alt Shift C'],
    ['ArrowRight', {}, '→'],
    ['PageDown', {}, 'Page Down'],
    ['Space', {}, 'Space'],
    ['Numpad1', {ctrlKey: true, numLock: true}, 'Ctrl Num 1'],
    ['Numpad1', {ctrlKey: true, numLock: false}, 'Ctrl Num 1'],
    ['Backspace', {ctrlKey: true}, 'Ctrl Backspace'],
    ['KeyC', {shiftKey: true}, 'Shift C'],
  ])(
    'names a recorded %s %j in English, and the binding can be stored',
    (code, options, name) => {
      const recorded = shortcutPress(press(code, options));
      if (recorded.kind !== 'record') throw new Error('No binding recorded');

      expect(recorded.binding.code).toBe(code);
      expect(shortcutNames(recorded.binding).join(' ')).toBe(name);
      expect(
        serializeShortcuts(
          {
            format: 'llsettings.shortcuts',
            schemaVersion: 1,
            bindings: {test: [recorded.binding]},
          },
          'shortcuts.json',
        ).ok,
      ).toBe(true);
    },
  );
});
