import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {DetailsSlides} from '@renderer/features/service/details/DetailsSlides';

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
