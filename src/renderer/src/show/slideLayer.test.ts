import {describe, expect, it} from 'vitest';
import type {SlideTile} from './model';
import {slideLayerOf} from './slideLayer';

const tiles: Readonly<Record<string, readonly SlideTile[]>> = {
  song: [
    {label: '1절', labelColor: 'teal', lines: ['a', 'b']},
    {label: null, labelColor: 'none', lines: ['c']},
  ],
};
const tilesOf = (itemId: string): readonly SlideTile[] => tiles[itemId] ?? [];

describe('slideLayerOf', () => {
  it('builds the layer that outputting the tile sends', () => {
    expect(slideLayerOf({itemId: 'song', index: 0}, tilesOf)).toEqual({
      itemId: 'song',
      position: 0,
      label: '1절',
      lines: ['a', 'b'],
      next: {label: null, lines: ['c']},
    });
    const last = slideLayerOf({itemId: 'song', index: 1}, tilesOf);
    expect(last?.label).toBeNull();
    expect(last).not.toHaveProperty('next');
  });

  it('returns nothing for a tile that does not exist', () => {
    expect(slideLayerOf({itemId: 'song', index: 2}, tilesOf)).toBeNull();
    expect(slideLayerOf({itemId: 'other', index: 0}, tilesOf)).toBeNull();
  });
});
