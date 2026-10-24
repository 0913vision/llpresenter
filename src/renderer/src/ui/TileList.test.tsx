import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {CLICK_FOCUS_SELECTOR} from './clickFocus';
import type {MenuAnchor} from './Menu';
import {stripMoves, TileList, type TileListProps} from './TileList';

const NAMES = ['따뜻한 빛', '새벽 하늘', '별빛', '푸른 빛'];
const BUSY = 2;

type Handlers = Partial<
  Pick<TileListProps, 'onActivate' | 'onDoubleClick' | 'onMenu'>
>;

function Strip(handlers: Handlers): JSX.Element {
  const [selected, setSelected] = useState(0);
  return (
    <TileList
      label="미디어"
      moves={stripMoves}
      columns={NAMES.length}
      spaceKey="pass"
      selected={selected}
      onSelect={setSelected}
      onActivate={handlers.onActivate ?? (() => {})}
      onDoubleClick={handlers.onDoubleClick}
      onMenu={handlers.onMenu}
    >
      {NAMES.map((name, index) => (
        <button
          key={name}
          type="button"
          role="option"
          aria-selected={index === selected}
          aria-disabled={index === BUSY ? true : undefined}
          tabIndex={index === selected ? 0 : -1}
        >
          {name}
        </button>
      ))}
    </TileList>
  );
}

function tile(name: string): HTMLElement {
  return screen.getByRole('option', {name});
}

describe('TileList', () => {
  it('moves along a strip with ← and → only', async () => {
    render(<Strip />);
    tile('따뜻한 빛').focus();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    expect(document.activeElement).toBe(tile('새벽 하늘'));
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(tile('따뜻한 빛'));
  });

  it('activates a tile on a click and on Enter but not a disabled one', async () => {
    const onActivate = vi.fn<(index: number) => void>();
    render(<Strip onActivate={onActivate} />);
    await userEvent.click(tile('새벽 하늘'));
    await userEvent.click(tile('별빛'));
    tile('푸른 빛').focus();
    await userEvent.keyboard('{Enter}');
    expect(onActivate.mock.calls).toEqual([[1], [3]]);
  });

  it('reports a double click on a tile that is not disabled', async () => {
    const onDoubleClick = vi.fn<(index: number) => void>();
    render(<Strip onDoubleClick={onDoubleClick} />);
    await userEvent.dblClick(tile('푸른 빛'));
    await userEvent.dblClick(tile('별빛'));
    expect(onDoubleClick.mock.calls).toEqual([[3]]);
  });

  it('opens the menu at the pointer on a right-click', () => {
    const onMenu = vi.fn<(index: number, anchor: MenuAnchor) => void>();
    render(<Strip onMenu={onMenu} />);
    const event = fireEvent.contextMenu(tile('별빛'), {
      clientX: 40,
      clientY: 60,
    });
    expect(event).toBe(false);
    expect(onMenu).toHaveBeenCalledWith(BUSY, {
      kind: 'point',
      point: {x: 40, y: 60},
    });
  });

  it('opens the menu at the tile with Shift F10 and the Menu key', async () => {
    const onMenu = vi.fn<(index: number, anchor: MenuAnchor) => void>();
    render(<Strip onMenu={onMenu} />);
    tile('따뜻한 빛').focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}{ContextMenu}');
    const anchor = {kind: 'element', element: tile('따뜻한 빛')};
    expect(onMenu.mock.calls).toEqual([
      [0, anchor],
      [0, anchor],
    ]);
  });

  it('leaves click focus to the page unless it takes it', () => {
    render(<Strip />);
    expect(tile('별빛').closest(CLICK_FOCUS_SELECTOR)).toBe(null);
  });
});
