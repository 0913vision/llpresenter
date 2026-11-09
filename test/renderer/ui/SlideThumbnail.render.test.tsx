import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import type {LabelColor} from '@core/labels/colors';
import {describe, expect, it, vi} from 'vitest';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui/SlideThumbnail';

const inkRenders = vi.hoisted((): string[] => []);

vi.mock('@renderer/ui/labelInk', () => ({
  labelInk: (color: string): Record<string, string> => {
    inkRenders.push(color);
    return {};
  },
}));

const colors: readonly LabelColor[] = [
  '#5FB8C2',
  '#8FBF7A',
  '#D6B35F',
  '#A99AE0',
];

function SongGrid(): JSX.Element {
  const [selected, setSelected] = useState(0);
  return (
    <ThumbnailGrid
      workspace="prep"
      label="슬라이드"
      columns={colors.length}
      selected={selected}
      onSelect={setSelected}
    >
      {colors.map((color, index) => (
        <SlideThumbnail
          key={color}
          number={index + 1}
          label={`label ${index + 1}`}
          labelColor={color}
          selected={index === selected}
        />
      ))}
    </ThumbnailGrid>
  );
}

describe('ThumbnailGrid rendering', () => {
  it('redraws only the thumbnails whose selection changed', async () => {
    render(<SongGrid />);
    inkRenders.length = 0;
    await userEvent.click(screen.getByRole('option', {name: '3 label 3'}));
    expect(inkRenders.toSorted()).toEqual(['#5FB8C2', '#D6B35F']);
  });
});
