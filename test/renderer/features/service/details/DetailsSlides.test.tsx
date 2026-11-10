import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {DetailsSlides} from '@renderer/features/service/details/DetailsSlides';
import {detailsGridGeometry} from '@renderer/features/service/details/detailsGridGeometry';

it('draws only the initial window of a long item and selects without output', async () => {
  const draw = vi.fn((index: number) => <span>{`picture ${index}`}</span>);
  const select = vi.fn();
  render(
    <DetailsSlides
      count={1000}
      selected={0}
      onSelect={select}
      onEdit={vi.fn()}
      labelAt={() => undefined}
      colorAt={() => 'none'}
      picture={draw}
    />,
  );
  const grid = screen.getByRole('listbox', {name: '슬라이드'});
  const slides = within(grid).getAllByRole('option');
  expect(slides.length).toBeLessThan(1000);
  expect(draw.mock.calls.length).toBeLessThan(1000);
  if (slides[1] === undefined) throw new Error('Missing second slide');
  await userEvent.click(slides[1]);
  expect(select).toHaveBeenCalledWith(1);
});

it.each([
  [50, 3],
  [75, 2],
  [100, 2],
  [125, 1],
  [150, 1],
  [175, 1],
  [200, 1],
])('uses %i%% zoom for %i columns at the panel width', (scale, columns) => {
  expect(detailsGridGeometry(456, 12, scale).columns).toBe(columns);
});

it.each([
  [50, 3],
  [100, 2],
  [200, 1],
])(
  'keeps windowing and vertical keyboard movement aligned at %i%%',
  async (scale, columns) => {
    const width = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(456);
    const height = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(300);
    const select = vi.fn();
    const draw = vi.fn((index: number) => <span>{index}</span>);
    const view = render(
      <div style={{overflowY: 'auto'}}>
        <DetailsSlides
          count={1000}
          scale={scale}
          selected={0}
          onSelect={select}
          onEdit={vi.fn()}
          labelAt={() => undefined}
          colorAt={() => 'none'}
          picture={draw}
        />
      </div>,
    );
    try {
      const grid = screen.getByRole('listbox', {name: '슬라이드'});
      expect(grid.style.getPropertyValue('--thumb-columns')).toBe(
        String(columns),
      );
      expect(within(grid).getAllByRole('option').length).toBeLessThan(1000);
      const first = within(grid).getAllByRole('option')[0];
      if (first === undefined) throw Error('Missing slide');
      await userEvent.click(first);
      await userEvent.keyboard('{ArrowDown}');
      expect(select).toHaveBeenLastCalledWith(columns);
    } finally {
      view.unmount();
      width.mockRestore();
      height.mockRestore();
    }
  },
);
