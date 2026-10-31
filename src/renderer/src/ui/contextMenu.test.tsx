import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {expect, it} from 'vitest';
import {Menu, type MenuAnchor} from './Menu';
import {
  contextMenuAnchor,
  isContextMenuKey,
  markMenuTarget,
} from './contextMenu';

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

it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
  'marks the focused row for $key',
  keys => {
    render(<Harness />);
    const target = screen.getByRole('button', {name: '첫 대상'});
    target.focus();
    fireEvent.keyDown(target, keys);
    expect(target.hasAttribute('data-menu-target')).toBe(true);
    fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
    expect(target.hasAttribute('data-menu-target')).toBe(false);
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
