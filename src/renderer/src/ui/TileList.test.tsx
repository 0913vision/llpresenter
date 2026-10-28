import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {CLICK_FOCUS_SELECTOR} from './clickFocus';
import type {MenuAnchor} from './Menu';
import {gridMoves, stripMoves, TileList, type TileListProps} from './TileList';

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
      arrowsMove="selection"
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
        >
          {name}
        </button>
      ))}
    </TileList>
  );
}

const MACROS = ['예배 시작', '찬양', '말씀', '광고', '헌금'];
const ROW_LENGTH = 3;
const ROW_HEIGHT = 100;

function Macros({
  onActivate = () => {},
}: {
  readonly onActivate?: (index: number) => void;
}): JSX.Element {
  return (
    <>
      <button type="button">밖</button>
      <TileList
        label="매크로"
        moves={gridMoves}
        columns="auto"
        spaceKey="press"
        arrowsMove="focus"
        selected={MACROS.length - 1}
        onActivate={onActivate}
      >
        {MACROS.map((name, index) => (
          <button
            key={name}
            type="button"
            role="option"
            aria-selected={index === MACROS.length - 1}
            data-row={Math.floor(index / ROW_LENGTH)}
          >
            {name}
          </button>
        ))}
      </TileList>
    </>
  );
}

function layOutInRows(): void {
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
    function (this: HTMLElement): number {
      return Number(this.dataset['row'] ?? 0) * ROW_HEIGHT;
    },
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

  it('activates once while Enter is held', async () => {
    const onActivate = vi.fn<(index: number) => void>();
    render(<Strip onActivate={onActivate} />);
    tile('푸른 빛').focus();
    await userEvent.keyboard('{Enter>4/}');
    expect(onActivate.mock.calls).toEqual([[3]]);
  });

  it('ignores Enter and Space pressed with a modifier', async () => {
    const onActivate = vi.fn<(index: number) => void>();
    render(<Macros onActivate={onActivate} />);
    screen.getByRole('option', {name: '찬양'}).focus();
    for (const modifier of ['Control', 'Shift', 'Alt', 'Meta']) {
      await userEvent.keyboard(`{${modifier}>}{Enter}[Space]{/${modifier}}`);
    }
    expect(onActivate).not.toHaveBeenCalled();
    await userEvent.keyboard('[Space]');
    expect(onActivate.mock.calls).toEqual([[1]]);
  });

  it('ignores a Space whose modifier is released before it', async () => {
    const onActivate = vi.fn<(index: number) => void>();
    render(<Macros onActivate={onActivate} />);
    screen.getByRole('option', {name: '찬양'}).focus();
    await userEvent.keyboard('{Shift>}[Space>]{/Shift}[/Space]');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('presses only on the keyup of a plain Space keydown on the same tile', () => {
    const onActivate = vi.fn<(index: number) => void>();
    render(<Macros onActivate={onActivate} />);
    fireEvent.keyUp(tile('찬양'), {key: ' '});
    fireEvent.keyDown(tile('찬양'), {key: ' '});
    fireEvent.keyUp(tile('말씀'), {key: ' '});
    expect(onActivate).not.toHaveBeenCalled();
    fireEvent.keyDown(tile('찬양'), {key: ' '});
    fireEvent.keyUp(tile('찬양'), {key: ' '});
    expect(onActivate.mock.calls).toEqual([[1]]);
  });

  it('cancels the Space keydown it takes and leaves the one it passes on', () => {
    render(
      <>
        <Strip />
        <Macros />
      </>,
    );
    expect(fireEvent.keyDown(tile('새벽 하늘'), {key: ' '})).toBe(true);
    expect(fireEvent.keyDown(tile('찬양'), {key: ' '})).toBe(false);
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

  it('passes modified context-menu combinations without opening the menu', () => {
    const onMenu = vi.fn();
    render(<Strip onMenu={onMenu} />);
    const target = tile('따뜻한 빛');
    const keys = vi.fn();
    window.addEventListener('keydown', keys);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
      expect(
        fireEvent.keyDown(target, {
          key: 'F10',
          shiftKey: true,
          [modifier]: true,
        }),
      ).toBe(true);
    }
    window.removeEventListener('keydown', keys);
    expect(keys).toHaveBeenCalledTimes(3);
    expect(onMenu).not.toHaveBeenCalled();
    fireEvent.keyDown(target, {key: 'ContextMenu', ctrlKey: true});
    expect(onMenu).toHaveBeenCalledOnce();
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

  it('keeps one Tab stop that starts on the selected tile', async () => {
    render(<Strip />);
    const stops = screen.getAllByRole('option').map(option => option.tabIndex);
    expect(stops).toEqual([0, -1, -1, -1]);
  });

  it('moves only focus with focus arrows, and Tab comes back to it', async () => {
    const onActivate = vi.fn<(index: number) => void>();
    render(<Macros onActivate={onActivate} />);
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(tile('예배 시작'));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(tile('말씀'));
    expect(tile('헌금').getAttribute('aria-selected')).toBe('true');
    await userEvent.tab({shift: true});
    await userEvent.tab();
    expect(document.activeElement).toBe(tile('말씀'));
    await userEvent.keyboard(' ');
    expect(onActivate).toHaveBeenCalledWith(2);
  });

  it('reads the column count from the layout with auto columns', async () => {
    layOutInRows();
    render(<Macros />);
    tile('찬양').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(tile('헌금'));
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(tile('찬양'));
  });

  it('leaves click focus to the page unless it takes it', () => {
    render(<Strip />);
    expect(tile('별빛').closest(CLICK_FOCUS_SELECTOR)).toBe(null);
  });
});
