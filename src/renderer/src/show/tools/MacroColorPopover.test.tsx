import {useState} from 'react';
import {act, cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {MacroColorPopover} from './MacroColorPopover';

const controls = new Set<HTMLElement>();
afterEach(() => {
  cleanup();
  for (const control of controls) control.remove();
  controls.clear();
});

function button(name: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.textContent = name;
  controls.add(element);
  return element;
}

function fixture() {
  const anchor = button('기준');
  document.body.append(anchor);
  const close = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(true);
    return open ? (
      <MacroColorPopover
        anchor={anchor}
        value="teal"
        locked={false}
        onChange={() => undefined}
        onClose={() => {
          close();
          setOpen(false);
        }}
      />
    ) : null;
  }
  render(<Harness />);
  const popup = screen.getByRole('dialog', {name: '매크로 색'});
  const layer = popup.closest('[data-llp-layer="popover"]');
  if (!layer) throw new Error('Missing popover layer');
  const previous = button('이전');
  const next = button('다음');
  layer.before(previous);
  layer.after(next);
  return {previous, next, close};
}

it.each([false, true])(
  'dismisses on Tab with shift=%s without stealing the destination focus',
  async shift => {
    const {previous, next, close} = fixture();
    expect(document.activeElement).toBe(
      screen.getByRole('radio', {name: '청록'}),
    );
    await userEvent.tab({shift});
    expect(screen.queryByRole('dialog', {name: '매크로 색'})).toBeNull();
    expect(document.activeElement).toBe(shift ? previous : next);
    expect(close).toHaveBeenCalledOnce();
  },
);

it('keeps the popover open when focus moves between its swatches', () => {
  const {close} = fixture();
  act(() => screen.getByRole('radio', {name: '초록'}).focus());
  expect(screen.getByRole('dialog', {name: '매크로 색'})).toBeDefined();
  expect(close).not.toHaveBeenCalled();
});
