import {afterEach, describe, expect, it} from 'vitest';
import {
  focusedControlOwnsKey,
  isTextField,
} from '@renderer/ui/keys/keyOwnership';

afterEach(() => {
  document.body.innerHTML = '';
});

function keyOn(
  html: string,
  code: string,
  modifiers: KeyboardEventInit = {},
): KeyboardEvent {
  document.body.innerHTML = html;
  const target = document.querySelector('[data-target]');
  if (target === null) throw new Error('No target');
  const event = new KeyboardEvent('keydown', {
    code,
    bubbles: true,
    ...modifiers,
  });
  Object.defineProperty(event, 'target', {value: target});
  return event;
}

describe('focusedControlOwnsKey', () => {
  it('gives a list its arrows, Home, End and Enter, and nothing else', () => {
    const list =
      '<div role="listbox"><div role="option" data-target></div></div>';

    for (const code of ['ArrowDown', 'Home', 'End', 'Enter']) {
      expect(focusedControlOwnsKey(keyOn(list, code))).toBe(true);
    }
    expect(focusedControlOwnsKey(keyOn(list, 'Space'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(list, 'KeyB'))).toBe(false);
  });

  it('leaves the 진행 slide grid arrows and Enter to the slide keys', () => {
    const grid =
      '<div data-show-slide-grid="true"><div role="listbox"><div role="option" data-target></div></div></div>';

    expect(focusedControlOwnsKey(keyOn(grid, 'ArrowRight'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(grid, 'ArrowDown'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(grid, 'Enter'))).toBe(false);
  });

  it('gives a button Space and Enter, and a tab or field its arrows', () => {
    expect(
      focusedControlOwnsKey(keyOn('<button data-target></button>', 'Space')),
    ).toBe(true);
    expect(
      focusedControlOwnsKey(
        keyOn('<div role="tab" data-target></div>', 'ArrowLeft'),
      ),
    ).toBe(true);
    expect(
      focusedControlOwnsKey(
        keyOn('<button data-target></button>', 'ArrowLeft'),
      ),
    ).toBe(false);
  });

  it('never takes a key pressed with Ctrl, Alt or Shift, nor one on a canvas', () => {
    expect(
      focusedControlOwnsKey(
        keyOn('<button data-target></button>', 'Enter', {ctrlKey: true}),
      ),
    ).toBe(false);
    expect(
      focusedControlOwnsKey(
        keyOn(
          '<div data-command-context="canvas"><div role="listbox"><div data-target></div></div></div>',
          'ArrowDown',
        ),
      ),
    ).toBe(false);
  });
});

describe('isTextField', () => {
  it('counts typing fields but not buttons and boxes that look like inputs', () => {
    expect(isTextField(keyOn('<input type="text" data-target>', 'KeyA'))).toBe(
      true,
    );
    expect(
      isTextField(keyOn('<textarea data-target></textarea>', 'KeyA')),
    ).toBe(true);
    expect(
      isTextField(keyOn('<input type="checkbox" data-target>', 'KeyA')),
    ).toBe(false);
    expect(isTextField(keyOn('<button data-target></button>', 'KeyA'))).toBe(
      false,
    );
  });
});
