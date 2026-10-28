import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useChoicePopup} from './useChoicePopup';

const anchors = new Set<HTMLElement>();
afterEach(() => {
  cleanup();
  for (const anchor of anchors) anchor.remove();
  anchors.clear();
});

function Choices({
  anchor,
  onClose,
  onEscape,
  checked = true,
}: {
  readonly anchor: HTMLElement;
  readonly onClose: (restore: boolean) => void;
  readonly onEscape: () => void;
  readonly checked?: boolean;
}) {
  const {surface, onKeyDown} = useChoicePopup({anchor, onClose, onEscape});
  return (
    <div data-llp-layer="popover">
      <div role="menu" ref={surface} onKeyDown={onKeyDown}>
        <button
          type="button"
          role="menuitemradio"
          data-choice
          aria-checked={false}
        >
          Amber
        </button>
        <button
          type="button"
          role="menuitemradio"
          data-choice
          aria-checked={checked}
        >
          Blue
        </button>
        <input aria-label="Search" />
      </div>
    </div>
  );
}

function setup(checked = true) {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  anchors.add(anchor);
  const onClose = vi.fn();
  const onEscape = vi.fn();
  const view = render(
    <Choices
      anchor={anchor}
      onClose={onClose}
      onEscape={onEscape}
      checked={checked}
    />,
  );
  return {view, anchor, onClose, onEscape};
}

it('focuses the checked choice and retains wrapping navigation, endpoints and typeahead', () => {
  setup();
  const amber = screen.getByRole('menuitemradio', {name: 'Amber'});
  const blue = screen.getByRole('menuitemradio', {name: 'Blue'});
  expect(document.activeElement).toBe(blue);
  fireEvent.keyDown(blue, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(amber);
  fireEvent.keyDown(amber, {key: 'ArrowUp'});
  expect(document.activeElement).toBe(blue);
  fireEvent.keyDown(blue, {key: 'Home'});
  expect(document.activeElement).toBe(amber);
  fireEvent.keyDown(amber, {key: 'End'});
  expect(document.activeElement).toBe(blue);
  fireEvent.keyDown(blue, {key: 'a', ctrlKey: true});
  expect(document.activeElement).toBe(blue);
  fireEvent.keyDown(blue, {key: 'a'});
  expect(document.activeElement).toBe(amber);
});

it('passes modified navigation keys without moving focus', () => {
  setup();
  const blue = screen.getByRole('menuitemradio', {name: 'Blue'});
  const onKeyDown = vi.fn();
  window.addEventListener('keydown', onKeyDown);
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      expect(fireEvent.keyDown(blue, {key, [modifier]: true})).toBe(true);
      expect(document.activeElement).toBe(blue);
    }
  }
  window.removeEventListener('keydown', onKeyDown);
  expect(onKeyDown).toHaveBeenCalledTimes(16);
  fireEvent.keyDown(blue, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(
    screen.getByRole('menuitemradio', {name: 'Amber'}),
  );
});

it('falls back to the first choice and leaves typing and composing Escape to the input', () => {
  const {onEscape} = setup(false);
  expect(document.activeElement).toBe(
    screen.getByRole('menuitemradio', {name: 'Amber'}),
  );
  const input = screen.getByLabelText('Search');
  input.focus();
  fireEvent.keyDown(input, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, {key: 'Escape', isComposing: true});
  expect(onEscape).not.toHaveBeenCalled();
  fireEvent.keyDown(input, {key: 'Escape'});
  expect(onEscape).toHaveBeenCalledOnce();
});

it('ignores inside, anchor and dialog interactions, uses the latest callback and releases listeners', () => {
  const {view, anchor, onClose, onEscape} = setup();
  const choice = screen.getByRole('menuitemradio', {name: 'Blue'});
  fireEvent.pointerDown(choice);
  fireEvent.pointerDown(anchor);
  fireEvent.scroll(screen.getByRole('menu'));
  const dialog = document.createElement('div');
  dialog.dataset['llpLayer'] = 'dialog';
  document.body.append(dialog);
  anchors.add(dialog);
  fireEvent.pointerDown(dialog);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.scroll(document.body);
  expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
  const latest = vi.fn();
  view.rerender(
    <Choices anchor={anchor} onClose={latest} onEscape={onEscape} />,
  );
  fireEvent.pointerDown(document.body);
  expect(latest).toHaveBeenCalledExactlyOnceWith(false);
  fireEvent.resize(window);
  expect(latest).toHaveBeenCalledTimes(2);
  view.unmount();
  fireEvent.resize(window);
  fireEvent.pointerDown(document.body);
  fireEvent.scroll(document.body);
  expect(latest).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledOnce();
});
