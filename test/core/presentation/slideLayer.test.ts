import {describe, expect, it} from 'vitest';
import {lyricsSlide} from '@fixtures/core/slides';
import type {ItemId, SlideTile} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation';
import type {ThemeFile} from '@core/schema/screens/theme';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';

const lyricsTheme = BUILT_IN_THEMES.find(
  theme => theme.id === BUILT_IN_THEME_IDS.lyrics,
);

function theme(): ThemeFile {
  if (lyricsTheme === undefined) throw new Error('No lyrics theme');
  return lyricsTheme;
}

function tile(
  number: number,
  text: string,
  more: Parameters<typeof lyricsSlide>[2] = {},
): SlideTile {
  return {
    slide: lyricsSlide(number, text, more),
    auto: {},
    caption: null,
    labelColor: 'none',
  };
}

const song: readonly SlideTile[] = [
  tile(1, '첫째 줄'),
  tile(2, '둘째 줄'),
  tile(3, '셋째 줄', {hideNext: true}),
  tile(4, '넷째 줄'),
];
const other: readonly SlideTile[] = [tile(11, '다른 곡 첫 줄')];
const tiles: Readonly<Record<ItemId, readonly SlideTile[]>> = {
  song,
  other,
};
function tilesOf(itemId: ItemId): readonly SlideTile[] {
  return tiles[itemId] ?? [];
}

describe('slideLayerOf', () => {
  it('sends the tile with its place in the item and the next line', () => {
    const layer = slideLayerOf({itemId: 'song', index: 0}, tilesOf, {
      theme,
      following: {itemId: 'song', index: 1},
    });

    expect(layer).toMatchObject({
      itemId: 'song',
      slideId: song[0]?.slide.id,
      position: 0,
      sequenceLength: 4,
      texts: {가사: '첫째 줄'},
    });
    expect(layer?.next).toContain('둘째 줄');
  });

  it('takes the next line from the item the next key goes to', () => {
    const layer = slideLayerOf({itemId: 'song', index: 3}, tilesOf, {
      theme,
      following: {itemId: 'other', index: 0},
    });

    expect(layer?.next).toContain('다른 곡 첫 줄');
  });

  it('shows no next line after the last tile or on a slide that hides it', () => {
    const last = slideLayerOf({itemId: 'song', index: 3}, tilesOf, {
      theme,
      following: null,
    });
    const hidden = slideLayerOf({itemId: 'song', index: 2}, tilesOf, {
      theme,
      following: {itemId: 'song', index: 3},
    });

    expect(last?.next).toBeNull();
    expect(hidden?.next).toBeNull();
  });

  it('sends nothing for a tile that is not there', () => {
    expect(
      slideLayerOf({itemId: 'song', index: 9}, tilesOf, {
        theme,
        following: null,
      }),
    ).toBeNull();
  });

  it('adds the optional fields only when the slide has them', () => {
    const plain = slideLayerOf({itemId: 'song', index: 0}, tilesOf, {
      theme,
      following: null,
    });

    expect(plain).not.toHaveProperty('background');
    expect(plain).not.toHaveProperty('transition');
    expect(plain).not.toHaveProperty('verse');
    expect(plain).not.toHaveProperty('continued');
  });
});
