import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MacroIconDialog} from './MacroIconDialog';

afterEach(cleanup);

it('offers actual icon assets and moves focus without selecting on arrow keys', () => {
  const save = vi.fn();
  render(
    <MacroIconDialog
      value="macro"
      locked={false}
      close={() => undefined}
      save={save}
    />,
  );
  const grid = screen.getByRole('group', {name: '\uc544\uc774\ucf58'});
  const selected = within(grid).getByRole('button', {
    name: '\uc544\uc774\ucf58 macro',
  });
  expect(selected.getAttribute('aria-pressed')).toBe('true');
  expect(selected.getAttribute('tabindex')).toBe('0');
  selected.focus();
  fireEvent.keyDown(selected, {key: 'ArrowRight'});
  const next = document.activeElement;
  expect(next).not.toBe(selected);
  expect(save).not.toHaveBeenCalled();
  if (!(next instanceof HTMLButtonElement)) {
    throw new Error('Missing focused icon');
  }
  fireEvent.click(next);
  expect(save).toHaveBeenCalledOnce();
});

it('does not select an icon while locked', () => {
  const save = vi.fn();
  render(
    <MacroIconDialog
      value="macro"
      locked
      close={() => undefined}
      save={save}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', {name: '\uc544\uc774\ucf58 macro'}),
  );
  expect(save).not.toHaveBeenCalled();
});
