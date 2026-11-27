import {useState, type JSX} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {
  useInputCompletion,
  type InputCompletion,
} from '@renderer/ui/fields/useInputCompletion';

/** A search box whose Tab takes `offer`, as the menu search does. */
function Search({
  offer,
  onTaken,
}: {
  readonly offer: InputCompletion | null;
  readonly onTaken: (taken: boolean) => void;
}): JSX.Element {
  const [text, setText] = useState('창');
  const complete = useInputCompletion(setText);
  return (
    <input
      aria-label="검색"
      value={text}
      onChange={event => setText(event.currentTarget.value)}
      onKeyDown={event => onTaken(complete(event, offer))}
    />
  );
}

function setup(offer: InputCompletion | null) {
  const taken = vi.fn<(taken: boolean) => void>();
  render(<Search offer={offer} onTaken={taken} />);
  const box = screen.getByRole<HTMLInputElement>('textbox', {name: '검색'});
  box.focus();
  return {box, taken};
}

it('takes the suggestion with Tab, writes it and puts the caret where it says', () => {
  const {box, taken} = setup({input: '창세기 ', caret: 4});
  const tab = fireEvent.keyDown(box, {key: 'Tab'});
  expect(tab).toBe(false);
  expect(taken).toHaveBeenLastCalledWith(true);
  expect(box.value).toBe('창세기 ');
  expect([box.selectionStart, box.selectionEnd]).toEqual([4, 4]);
});

it.each([
  ['Shift+Tab', {key: 'Tab', shiftKey: true}],
  ['Ctrl+Tab', {key: 'Tab', ctrlKey: true}],
  ['Enter', {key: 'Enter'}],
  [
    'Tab while a Korean letter is being composed',
    {key: 'Tab', isComposing: true},
  ],
])('leaves %s to the window', (_name, key) => {
  const {box, taken} = setup({input: '창세기 ', caret: 4});
  expect(fireEvent.keyDown(box, key)).toBe(true);
  expect(taken).toHaveBeenLastCalledWith(false);
  expect(box.value).toBe('창');
});

it('leaves Tab to the window when there is nothing to complete', () => {
  const {box, taken} = setup(null);
  expect(fireEvent.keyDown(box, {key: 'Tab'})).toBe(true);
  expect(taken).toHaveBeenLastCalledWith(false);
});

it('keeps a held Tab from writing the suggestion again', () => {
  const {box, taken} = setup({input: '창세기 ', caret: 4});
  fireEvent.change(box, {target: {value: '창세'}});
  expect(fireEvent.keyDown(box, {key: 'Tab', repeat: true})).toBe(false);
  expect(taken).toHaveBeenLastCalledWith(true);
  expect(box.value).toBe('창세');
});
