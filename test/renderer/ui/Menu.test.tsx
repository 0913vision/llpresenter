import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {Menu} from '@renderer/ui/Menu';
import {describe, expect, it, vi} from 'vitest';
import {
  Harness,
  installMenuTestHooks,
  openMenu,
} from '@fixtures/renderer/ui/menuTesting';

installMenuTestHooks();

describe('Menu', () => {
  it('leaves focus in an editable trigger when requested and releases it on pointer entry', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const view = render(
      <Menu
        label="이름표"
        entries={[]}
        anchor={{kind: 'element', element: input}}
        onClose={vi.fn()}
        autoFocus={false}
      />,
    );
    expect(document.activeElement).toBe(input);
    fireEvent.pointerEnter(screen.getByRole('menu'));
    expect(document.activeElement).toBe(screen.getByRole('menu'));
    view.unmount();
    input.remove();
  });

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

  it('closes on a right-click outside and passes the click on to what is under it', () => {
    const outside = document.createElement('button');
    const passed: MouseEvent[] = [];
    outside.addEventListener('contextmenu', event => passed.push(event));
    document.body.append(outside);
    const onClose = vi.fn();
    const view = render(
      <Menu
        context
        label="항목 메뉴"
        entries={[{kind: 'item', id: 'one', label: '하나', onSelect: vi.fn()}]}
        anchor={{kind: 'point', point: {x: 10, y: 10}}}
        onClose={onClose}
      />,
    );
    const catcher = document.querySelector(
      '[data-llp-layer="popover"] > div > div',
    );
    if (catcher === null) throw new Error('No click catcher');
    // NOTE(0913vision): jsdom has no elementsFromPoint; this one reports the
    // catcher and, under it, the outside button.
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [catcher, outside],
    });
    fireEvent.pointerDown(catcher, {button: 2, clientX: 300, clientY: 200});
    expect(onClose).toHaveBeenLastCalledWith('outside');
    fireEvent.contextMenu(catcher, {clientX: 300, clientY: 200});
    expect(
      passed.map(event => [event.clientX, event.clientY, event.button]),
    ).toEqual([[300, 200, 2]]);
    Reflect.deleteProperty(document, 'elementsFromPoint');
    view.unmount();
    outside.remove();
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
