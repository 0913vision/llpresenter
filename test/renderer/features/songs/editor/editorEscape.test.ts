import {expect, it} from 'vitest';
import {isEditorEscape} from '@renderer/features/songs/editor/editorEscape';

it('accepts only unmodified non-composing Escape outside a text field', () => {
  const input = document.createElement('input');
  document.body.append(input);
  const check = (target: HTMLElement, init: KeyboardEventInit): boolean => {
    let result = false;
    target.addEventListener(
      'keydown',
      event => {
        result = isEditorEscape(event);
      },
      {once: true},
    );
    target.dispatchEvent(
      new KeyboardEvent('keydown', {bubbles: true, ...init}),
    );
    return result;
  };
  expect(check(document.body, {key: 'Escape'})).toBe(true);
  expect(check(document.body, {key: 'Escape', ctrlKey: true})).toBe(false);
  expect(check(document.body, {key: 'Escape', isComposing: true})).toBe(false);
  expect(check(input, {key: 'Escape'})).toBe(false);
  input.remove();
});
