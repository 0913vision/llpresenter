import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {
  contextMenuAnchor,
  isContextMenuKey,
  markMenuTarget,
  openMenuFromKey,
} from '@renderer/ui/contextMenu';

function Harness() {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return (
    <>
      {['첫 대상', '다음 대상'].map(name => (
        <button
          key={name}
          type="button"
          data-value={name}
          onContextMenu={event => {
            event.preventDefault();
            setAnchor(contextMenuAnchor(event));
          }}
          onKeyDown={event => {
            if (isContextMenuKey(event)) {
              event.preventDefault();
              setAnchor(contextMenuAnchor(event));
            }
          }}
          onClick={event =>
            setAnchor({kind: 'element', element: event.currentTarget})
          }
        >
          <span>{name}</span>
        </button>
      ))}
      {anchor ? (
        <Menu
          label="대상 메뉴"
          anchor={anchor}
          onClose={() => setAnchor(null)}
          entries={[{kind: 'item', id: 'run', label: '실행'}]}
        />
      ) : null}
    </>
  );
}

it.each(['select', 'Escape', 'outside', 'unmount'])(
  'marks only the target and clears it on %s',
  close => {
    const view = render(<Harness />);
    const target = screen.getByRole('button', {name: '첫 대상'});
    fireEvent.contextMenu(screen.getByText('첫 대상'), {
      clientX: 40,
      clientY: 60,
    });
    expect(target.hasAttribute('data-menu-target')).toBe(true);
    expect(
      screen
        .getByRole('button', {name: '다음 대상'})
        .hasAttribute('data-menu-target'),
    ).toBe(false);
    const menu = screen.getByRole('menu');
    if (close === 'select') {
      fireEvent.click(screen.getByRole('menuitem', {name: '실행'}));
    } else if (close === 'Escape') fireEvent.keyDown(menu, {key: 'Escape'});
    else if (close === 'unmount') view.unmount();
    else {
      const catcher = menu.previousElementSibling;
      if (!catcher) throw Error('Missing outside catcher');
      fireEvent.pointerDown(catcher);
    }
    expect(target.hasAttribute('data-menu-target')).toBe(false);
  },
);

it.each(['{ContextMenu}', '{Shift>}{F10}{/Shift}'])(
  'marks the keyboard target and restores its focus after %s',
  async keys => {
    const user = userEvent.setup();
    render(<Harness />);
    const target = screen.getByRole('button', {name: '첫 대상'});
    await user.tab();
    expect(document.activeElement).toBe(target);
    await user.keyboard(keys);
    expect(target.hasAttribute('data-menu-target')).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('menu'));
    await user.keyboard('{Escape}');
    expect(target.hasAttribute('data-menu-target')).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(target));
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '다음 대상'}),
    );
  },
);

it('releases the previous target when an open menu changes targets', () => {
  render(<Harness />);
  const first = screen.getByRole('button', {name: '첫 대상'});
  const next = screen.getByRole('button', {name: '다음 대상'});
  fireEvent.contextMenu(first);
  fireEvent.contextMenu(next);
  expect(first.hasAttribute('data-menu-target')).toBe(false);
  expect(next.hasAttribute('data-menu-target')).toBe(true);
});

it('leaves ordinary click menus unmarked', () => {
  render(<Harness />);
  const target = screen.getByRole('button', {name: '첫 대상'});
  fireEvent.click(target);
  expect(screen.getByRole('menu')).toBeDefined();
  expect(target.hasAttribute('data-menu-target')).toBe(false);
});

it('keeps a shared target marked until all its menus release it', () => {
  const target = document.createElement('div');
  const release = markMenuTarget(target);
  const releaseNext = markMenuTarget(target);
  release();
  release();
  expect(target.hasAttribute('data-menu-target')).toBe(true);
  releaseNext();
  expect(target.hasAttribute('data-menu-target')).toBe(false);
});

it.each([
  {key: 'ContextMenu', isComposing: true},
  {key: 'F10', shiftKey: true, isComposing: true},
  {key: 'ContextMenu', ctrlKey: true},
  {key: 'ContextMenu', altKey: true},
  {key: 'ContextMenu', metaKey: true},
  {key: 'ContextMenu', shiftKey: true},
  {key: 'F10', shiftKey: true, ctrlKey: true},
  {key: 'F10', shiftKey: true, altKey: true},
  {key: 'F10', shiftKey: true, metaKey: true},
  {key: 'F10'},
])('leaves IME and modified context keys to their owner: %j', keys => {
  render(<Harness />);
  fireEvent.keyDown(screen.getByRole('button', {name: '첫 대상'}), keys);
  expect(screen.queryByRole('menu')).toBeNull();
});

it.each(['input', 'textarea', 'editable'])(
  'does not open a surface menu from its %s editor',
  kind => {
    const open = vi.fn();
    render(
      <div
        onKeyDown={event => {
          if (isContextMenuKey(event)) open();
        }}
      >
        {kind === 'input' ? (
          <input aria-label="입력" />
        ) : kind === 'textarea' ? (
          <textarea aria-label="입력" />
        ) : (
          <div
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="입력"
          >
            <span>한글</span>
          </div>
        )}
      </div>,
    );
    const target =
      kind === 'editable'
        ? screen.getByText('한글')
        : screen.getByRole('textbox');
    fireEvent.keyDown(target, {key: 'ContextMenu'});
    fireEvent.keyDown(target, {key: 'F10', shiftKey: true});
    expect(open).not.toHaveBeenCalled();
  },
);

describe('openMenuFromKey', () => {
  function Row({
    onOpen,
    onOuterKey,
  }: {
    readonly onOpen: (anchor: MenuAnchor) => void;
    readonly onOuterKey: () => void;
  }) {
    return (
      <div role="group" onKeyDown={onOuterKey}>
        <div
          role="option"
          aria-selected="false"
          tabIndex={0}
          onKeyDown={event => openMenuFromKey(event, onOpen)}
        >
          <input aria-label="이름" />행
        </div>
      </div>
    );
  }

  it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
    'opens below the focused row and stops the press: %j',
    keyEvent => {
      const open = vi.fn();
      const outer = vi.fn();
      render(<Row onOpen={open} onOuterKey={outer} />);
      const row = screen.getByRole('option');
      fireEvent.keyDown(row, keyEvent);

      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({kind: 'element', element: row}),
      );
      expect(outer).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a key typed in a field', 'input', {key: 'ContextMenu'}],
    ['an Alt press', 'row', {key: 'ContextMenu', altKey: true}],
    ['Shift with the Menu key', 'row', {key: 'ContextMenu', shiftKey: true}],
    ['another key', 'row', {key: 'Enter'}],
  ])('leaves %s alone', (_name, where, keyEvent) => {
    const open = vi.fn();
    const outer = vi.fn();
    render(<Row onOpen={open} onOuterKey={outer} />);
    fireEvent.keyDown(
      where === 'input'
        ? screen.getByRole('textbox', {name: '이름'})
        : screen.getByRole('option'),
      keyEvent,
    );

    expect(open).not.toHaveBeenCalled();
    expect(outer).toHaveBeenCalled();
  });
});
