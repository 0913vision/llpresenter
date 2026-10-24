import {describe, expect, it} from 'vitest';
import {emptyLayers} from '@shared/live';
import type {SlideTile} from './model';
import {layersWithNextSlide, slideLayerOf} from './previewLayers';

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
    });
    expect(slideLayerOf({itemId: 'song', index: 1}, tilesOf)?.label).toBeNull();
  });

  it('returns nothing for a tile that does not exist', () => {
    expect(slideLayerOf({itemId: 'song', index: 2}, tilesOf)).toBeNull();
    expect(slideLayerOf({itemId: 'other', index: 0}, tilesOf)).toBeNull();
  });
});

describe('layersWithNextSlide', () => {
  const media = {mediaId: 'm', loop: true};
  const live = {
    ...emptyLayers(),
    media,
    slide: {itemId: 'song', position: 0, label: '1절', lines: ['a', 'b']},
  };

  it('replaces only the lyrics and keeps every other layer', () => {
    const next = {itemId: 'song', position: 1, label: null, lines: ['c']};
    expect(layersWithNextSlide(live, next)).toEqual({...live, slide: next});
    expect(layersWithNextSlide(live, next).media).toBe(media);
  });

  it('empties the lyrics when there is no next 장', () => {
    expect(layersWithNextSlide(live, null)).toEqual({...live, slide: null});
  });

  it('does not change the live layers', () => {
    layersWithNextSlide(live, null);
    expect(live.slide).not.toBeNull();
  });
});
