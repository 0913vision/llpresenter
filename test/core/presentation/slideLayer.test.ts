import {describe, expect, it} from 'vitest';
import type {SlideTile} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {createMediaId} from '@core/schema/ids';

const tiles: Readonly<Record<string, readonly SlideTile[]>> = {
  song: [
    {label: '1절', labelColor: '#5FB8C2', lines: ['a', 'b']},
    {label: null, labelColor: 'none', lines: ['c']},
  ],
};
const tilesOf = (itemId: string): readonly SlideTile[] => tiles[itemId] ?? [];

describe('slideLayerOf', () => {
  it('carries title identity into output without turning the next lyric into a title', () => {
    const deck: readonly SlideTile[] = [
      {
        titleSlide: true,
        titleLayout: {titleTracking: 12, subtitleTracking: 12},
        label: null,
        labelColor: 'none',
        lines: ['Title', 'Subtitle'],
      },
      {label: null, labelColor: 'none', lines: ['Lyric']},
    ];
    expect(slideLayerOf({itemId: 'song', index: 0}, () => deck)).toMatchObject({
      titleSlide: true,
      titleLayout: {titleTracking: 12, subtitleTracking: 12},
      lines: ['Title', 'Subtitle'],
      next: {lines: ['Lyric']},
    });
    expect(
      slideLayerOf({itemId: 'song', index: 1}, () => deck)?.titleSlide,
    ).toBeUndefined();
  });
  it('carries the incoming tile override independently of the next tile', () => {
    const transition = {kind: 'wipe', dir: 'down', sec: 4} as const;
    const deck: readonly SlideTile[] = [
      {label: null, labelColor: 'none', lines: ['A'], transition},
      {label: null, labelColor: 'none', lines: ['B']},
    ];
    expect(
      slideLayerOf({itemId: 'item', index: 0}, () => deck)?.transition,
    ).toEqual(transition);
    expect(
      slideLayerOf({itemId: 'item', index: 1}, () => deck)?.transition,
    ).toBeUndefined();
  });
  it('numbers ad text slides around pictures and renumbers after reorder or deletion', () => {
    const text: SlideTile = {
      kind: 'ad',
      label: null,
      labelColor: 'none',
      name: 'Notice',
      lines: ['Body'],
    };
    const picture: SlideTile = {
      ...text,
      picture: createMediaId('00000000-0000-4000-8000-000000000001'),
      lines: [],
    };
    for (const deck of [
      [picture, text, picture, text, text],
      [text, picture, text],
      [text, text, picture],
    ]) {
      let number = 0;
      for (const [index, tile] of deck.entries()) {
        const slide = slideLayerOf({itemId: 'ad', index}, () => deck);
        expect(slide?.textSlideNumber).toBe(
          tile.picture === undefined ? ++number : undefined,
        );
      }
    }
    expect(
      slideLayerOf({itemId: 'blank', index: 0}, () => [
        {...text, kind: 'blank'},
      ])?.textSlideNumber,
    ).toBeUndefined();
  });
  it('builds the layer that outputting the tile sends', () => {
    expect(slideLayerOf({itemId: 'song', index: 0}, tilesOf)).toEqual({
      itemId: 'song',
      position: 0,
      sequenceLength: 2,
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

  it('carries explicit continuation markers for the live and next parts', () => {
    const parts: readonly SlideTile[] = [
      {
        label: '3:16',
        labelColor: 'none',
        lines: ['가나 (계속)'],
        continued: true,
        biblePart: 1,
      },
      {
        label: '3:16',
        labelColor: 'none',
        lines: ['다라'],
        continued: false,
        biblePart: 2,
      },
    ];
    expect(
      slideLayerOf({itemId: 'bible', index: 0}, () => parts),
    ).toMatchObject({
      continued: true,
      biblePart: 1,
      next: {continued: false, biblePart: 2},
    });
  });

  it('carries an explicit Bible reference without treating song labels as references', () => {
    const bible: readonly SlideTile[] = [
      {
        label: '3:16',
        labelColor: 'none',
        lines: ['Invented'],
        reference: '3:16',
      },
    ];
    expect(
      slideLayerOf({itemId: 'bible', index: 0}, () => bible),
    ).toMatchObject({reference: '3:16'});
    expect(
      slideLayerOf({itemId: 'song', index: 0}, tilesOf),
    ).not.toHaveProperty('reference');
  });
});
