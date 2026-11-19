import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {useSelectionDelete} from '@renderer/ui/useSelectionDelete';

it.each([1, 3])(
  'deletes %i selected items immediately without a dialog or notice',
  count => {
    const remove = vi.fn();
    function Harness() {
      const deletion = useSelectionDelete();
      return (
        <>
          <button onClick={() => deletion.ask(count, () => true, remove)}>
            Delete
          </button>
          {deletion.dialog}
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  },
);

it('ignores an empty or invalid selection', () => {
  const remove = vi.fn();
  function Harness() {
    const deletion = useSelectionDelete();
    return (
      <>
        <button onClick={() => deletion.ask(0, () => true, remove)}>
          Empty
        </button>
        <button onClick={() => deletion.ask(2, () => false, remove)}>
          Invalid
        </button>
      </>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', {name: 'Empty'}));
  fireEvent.click(screen.getByRole('button', {name: 'Invalid'}));
  expect(remove).not.toHaveBeenCalled();
});
