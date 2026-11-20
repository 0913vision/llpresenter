import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {expect, it, vi} from 'vitest';
import {Popover} from '@renderer/ui/Popover';

it('returns to the focused keyboard target, even when the visual anchor differs', async () => {
  const shortcut = vi.fn<(key: string) => void>();
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <div data-workspace-layout="show">
        <div
          role="listbox"
          aria-label="selection"
          tabIndex={0}
          onKeyDown={event => {
            if (event.ctrlKey && event.key === 'g') setOpen(true);
            else if (event.key !== 'Control') shortcut(event.key);
          }}
        >
          <span>Visual anchor</span>
        </div>
        {open ? (
          <Popover>
            <button
              autoFocus
              onClick={() => setOpen(false)}
              onKeyDown={event => {
                if (event.key === 'Escape') setOpen(false);
              }}
            >
              Choose
            </button>
          </Popover>
        ) : null}
      </div>
    );
  }
  render(<Host />);
  const target = screen.getByRole('listbox', {name: 'selection'});
  target.focus();
  await userEvent.keyboard('{Control>}g{/Control}');
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).toBe(target);
  await userEvent.keyboard('{Control>}g{/Control}');
  await userEvent.click(screen.getByRole('button', {name: 'Choose'}));
  expect(document.activeElement).toBe(target);
  fireEvent.keyDown(document.activeElement ?? document.body, {key: 'Delete'});
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: 'ArrowDown',
  });
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: 'z',
    ctrlKey: true,
  });
  expect(shortcut.mock.calls.map(([key]) => key)).toEqual([
    'Delete',
    'ArrowDown',
    'z',
  ]);
});
