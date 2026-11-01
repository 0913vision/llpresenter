import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {
  INITIAL_ROWS,
  OVERSCAN_ROWS,
  VirtualMediaGrid,
} from '@renderer/features/media/VirtualMediaGrid';
import {MediaTile} from '@renderer/ui/MediaTile';
import {defaultThumbnailColumns} from '@renderer/ui/sizeClass';

const COUNT = 1000;
const COLUMNS = defaultThumbnailColumns.normal;
const BOUND = (INITIAL_ROWS + OVERSCAN_ROWS * 2) * COLUMNS;

function renderGrid(arrowsMove: 'selection' | 'focus' = 'selection') {
  const onSelect = vi.fn();
  const onOutput = vi.fn();
  render(
    <VirtualMediaGrid
      label="공지"
      count={COUNT}
      columns={COLUMNS}
      selected={undefined}
      arrowsMove={arrowsMove}
      onSelect={onSelect}
      onActivate={vi.fn()}
      onOutput={onOutput}
      onMenu={vi.fn()}
      tile={index => (
        <MediaTile
          key={index}
          name={`Invented ${index + 1}`}
          picture={`llp-media://thumbnail/${index + 1}`}
        />
      )}
    />,
  );
  const viewport = screen.getByRole('listbox', {name: '공지'}).parentElement
    ?.parentElement;
  if (viewport === null || viewport === undefined) {
    throw new Error('Missing viewport');
  }
  return {viewport, onSelect, onOutput};
}

describe('VirtualMediaGrid', () => {
  it('mounts only the rows in view and their overscan while scrolling', async () => {
    const {viewport} = renderGrid();
    expect(screen.getAllByRole('option')).toHaveLength(BOUND);
    expect(document.querySelectorAll('img')).toHaveLength(BOUND);
    expect(
      screen
        .getByRole('option', {name: 'Invented 1'})
        .getAttribute('aria-setsize'),
    ).toBe(String(COUNT));

    fireEvent.scroll(viewport, {target: {scrollTop: 100}});

    await screen.findByRole('option', {name: `Invented ${99 * COLUMNS + 1}`});
    expect(screen.queryByRole('option', {name: 'Invented 1'})).toBeNull();
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(BOUND);
  });

  it('moves keyboard focus within and across windows without selecting in focus mode', async () => {
    const user = userEvent.setup();
    const {viewport, onSelect, onOutput} = renderGrid('focus');
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: INITIAL_ROWS,
    });
    await user.tab();
    const moves = [
      ['{ArrowRight}', 2],
      ['{ArrowDown}', 6],
      ['{ArrowDown}', 10],
      ['{ArrowDown}', 14],
      ['{ArrowDown}', 18],
      ['{ArrowDown}', 22],
      ['{End}', COUNT],
      ['{ArrowLeft}', COUNT - 1],
      ['{Home}', 1],
    ] as const;

    for (const [key, index] of moves) {
      await user.keyboard(key);
      const target = await screen.findByRole('option', {
        name: `Invented ${index}`,
      });
      expect(document.activeElement).toBe(target);
      expect(
        screen.getAllByRole('option').filter(tile => tile.tabIndex === 0),
      ).toEqual([target]);
      expect(target.getAttribute('aria-posinset')).toBe(String(index));
      expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(BOUND);
    }

    expect(onSelect).not.toHaveBeenCalled();
    expect(onOutput).not.toHaveBeenCalled();
  });
});
