import {expect, it} from 'vitest';
import {textBoxHasKey} from '@renderer/ui/fields/textEntry';
import {optionKeyTarget} from '@renderer/ui/lists/selection/useRowRange';

function input(type: string): HTMLInputElement {
  const node = document.createElement('input');
  node.type = type;
  return node;
}

it('gives a key to a box that takes typed text, and not to buttons or pickers', () => {
  expect(textBoxHasKey(input('text'))).toBe(true);
  expect(textBoxHasKey(document.createElement('textarea'))).toBe(true);
  expect(textBoxHasKey(document.createElement('select'))).toBe(true);
  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  const inside = document.createElement('span');
  editable.append(inside);
  expect(textBoxHasKey(inside)).toBe(true);
  expect(textBoxHasKey(input('checkbox'))).toBe(false);
  expect(textBoxHasKey(input('range'))).toBe(false);
  expect(textBoxHasKey(document.createElement('button'))).toBe(false);
  expect(textBoxHasKey(null)).toBe(false);
});

it('leaves the arrows to a multi-line box inside a list row', () => {
  const row = document.createElement('div');
  row.setAttribute('role', 'option');
  const box = document.createElement('textarea');
  row.append(box);
  const key = {
    key: 'ArrowDown',
    target: box,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  expect(optionKeyTarget(key, ['a', 'b'], 'a')).toBeUndefined();
  expect(optionKeyTarget({...key, target: row}, ['a', 'b'], 'a')).toEqual({
    index: 1,
    id: 'b',
  });
});
