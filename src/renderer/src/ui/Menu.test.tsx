import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {Menu} from './Menu';
import {describe, expect, it, vi} from 'vitest';
import {Harness, installMenuTestHooks, openMenu} from './testing/menuTesting';

installMenuTestHooks();

describe('Menu', () => {
  it('retains an outside-blurred rename through a refused save and closes only after success', async () => {
    let finish: (saved: boolean) => void = () => undefined;
    const commit = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>(resolve => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce(true);
    const close = vi.fn();
    function RenameMenu() {
      const [editing, setEditing] = useState(true);
      return (
        <Menu
          label="목록"
          anchor={{kind: 'point', point: {x: 20, y: 20}}}
          onClose={close}
          entries={[
            {
              kind: 'item',
              id: 'name',
              label: '예배',
              rename: editing
                ? {
                    onCommit: commit,
                    onClose: () => setEditing(false),
                  }
                : undefined,
            },
          ]}
        />
      );
    }
    render(<RenameMenu />);
    const field = screen.getByRole('textbox', {name: '예배 이름'});
    fireEvent.change(field, {target: {value: '바뀐 예배'}});
    const catcher = document.querySelector(
      '[data-llp-layer="popover"] > div > div',
    );
    if (!catcher) throw Error('Missing menu catcher');
    await userEvent.pointer({keys: '[MouseLeft>]', target: catcher});
    expect(commit).toHaveBeenCalledExactlyOnceWith('바뀐 예배');
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish(false));
    expect(screen.getByDisplayValue('바뀐 예배')).toBe(field);
    expect(close).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(close).toHaveBeenCalledExactlyOnceWith('outside');
  });

  it('runs the pointed item with Enter, closes, and returns focus', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<Harness onSelect={onSelect} onClose={onClose} />);
    await openMenu();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('open');
    expect(onClose).toHaveBeenCalledWith('select');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '파일'}),
    );
  });

  it('closes on Tab and on a click outside', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openMenu();
    await userEvent.keyboard('{Tab}');
    expect(onClose).toHaveBeenLastCalledWith('tab');
    await openMenu();
    const catcher = document.querySelector(
      '[data-llp-layer="popover"] > div > div',
    );
    if (catcher === null) throw new Error('No click catcher');
    await userEvent.pointer({keys: '[MouseLeft>]', target: catcher});
    expect(onClose).toHaveBeenLastCalledWith('outside');
  });
});
