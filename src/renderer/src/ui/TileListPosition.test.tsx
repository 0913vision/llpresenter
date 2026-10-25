import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {SlideThumbnail, ThumbnailGrid} from './SlideThumbnail';
import type {TileListPosition} from './TileList';

function Window(props: TileListPosition) {
  return (
    <ThumbnailGrid
      {...props}
      label="슬라이드"
      workspace="prep"
      columns={3}
      selected={0}
      onSelect={vi.fn()}
    >
      <SlideThumbnail number={10} />
      <SlideThumbnail number={11} />
    </ThumbnailGrid>
  );
}

describe('tile window positions', () => {
  it('owns full-list position, size, and orientation through updates and removes omitted props', () => {
    const {rerender} = render(
      <Window positionOffset={9} setSize={1000} orientation="vertical" />,
    );
    const options = screen.getAllByRole('option');
    expect(options.map(option => option.getAttribute('aria-posinset'))).toEqual(
      ['10', '11'],
    );
    expect(options[1]?.getAttribute('aria-setsize')).toBe('1000');
    expect(screen.getByRole('listbox').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
    rerender(
      <Window positionOffset={99} setSize={2000} orientation="horizontal" />,
    );
    expect(options[0]?.getAttribute('aria-posinset')).toBe('100');
    expect(options[0]?.getAttribute('aria-setsize')).toBe('2000');
    expect(screen.getByRole('listbox').getAttribute('aria-orientation')).toBe(
      'horizontal',
    );
    rerender(<Window />);
    expect(options[0]?.hasAttribute('aria-posinset')).toBe(false);
    expect(options[0]?.hasAttribute('aria-setsize')).toBe(false);
    expect(screen.getByRole('listbox').hasAttribute('aria-orientation')).toBe(
      false,
    );
  });

  it.each([
    {positionOffset: -1, setSize: 1},
    {positionOffset: NaN, setSize: Infinity},
    {positionOffset: 0.5, setSize: -1},
  ])(
    'uses finite whole positions and includes all mounted tiles for %j',
    props => {
      render(<Window {...props} />);
      expect(
        screen.getAllByRole('option')[0]?.getAttribute('aria-posinset'),
      ).toBe('1');
      expect(
        screen.getAllByRole('option')[1]?.getAttribute('aria-setsize'),
      ).toBe('2');
    },
  );
});
