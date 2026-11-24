import {describe, expect, it} from 'vitest';
import {optionValueAt} from '@renderer/ui/lists/optionValue';

function list(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div role="listbox">
      <div role="option" data-value="first"><span class="name">첫째</span></div>
      <div role="option"><span class="plain">값 없음</span></div>
    </div>
    <p class="outside">밖</p>`;
  return root;
}

describe('optionValueAt', () => {
  it('reads the value of the row an event happened in, from the row or inside it', () => {
    const root = list();
    const row = root.querySelector('[data-value="first"]');
    expect(optionValueAt(row)).toBe('first');
    expect(optionValueAt(root.querySelector('.name'))).toBe('first');
  });

  it('has no value outside a row, in a row without one, or for no element', () => {
    const root = list();
    expect(optionValueAt(root.querySelector('.outside'))).toBeUndefined();
    expect(optionValueAt(root.querySelector('.plain'))).toBeUndefined();
    expect(optionValueAt(null)).toBeUndefined();
    expect(optionValueAt(window)).toBeUndefined();
  });
});
