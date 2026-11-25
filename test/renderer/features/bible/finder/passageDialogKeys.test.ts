import {expect, it} from 'vitest';
import {recentListTakes} from '@renderer/features/bible/finder/passageDialogKeys';

function keyOn(target: Element, key: string) {
  return {key, target};
}

function field(part?: string, expanded = false): HTMLInputElement {
  const input = document.createElement('input');
  if (part !== undefined) input.dataset['referencePart'] = part;
  if (expanded) input.setAttribute('aria-expanded', 'true');
  return input;
}

it('leaves every key to a text box that does not search the passage', () => {
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) {
    expect(recentListTakes(keyOn(field(), key))).toBe(false);
    expect(
      recentListTakes(keyOn(document.createElement('textarea'), key)),
    ).toBe(false);
  }
});

it('takes the arrows from the search fields and from outside any text box', () => {
  expect(recentListTakes(keyOn(field('chapter'), 'ArrowDown'))).toBe(true);
  expect(recentListTakes(keyOn(field('book'), 'ArrowUp'))).toBe(true);
  expect(
    recentListTakes(keyOn(document.createElement('button'), 'Enter')),
  ).toBe(true);
});

it('lets the open book list take its own keys first', () => {
  expect(recentListTakes(keyOn(field('book', true), 'ArrowDown'))).toBe(false);
});
