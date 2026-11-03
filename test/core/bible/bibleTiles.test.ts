import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {bibleSource} from '@core/bible/source';
import {translationIdSchema} from '@core/schema/ids';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';

function passage(verses: ReadonlyArray<readonly [number, number, string]>) {
  return {
    translation: v.parse(translationIdSchema, 'sample'),
    ref: '요한복음 3:34-4:2',
    displayRef: '요한복음 3:34-4:2',
    verses: verses.map(([chapter, verse, text]) => ({chapter, verse, text})),
  };
}

const JOHN = passage([
  [3, 34, 'a'],
  [3, 35, 'b'],
  [3, 36, 'c'],
  [4, 1, 'd'],
  [4, 2, 'e'],
]);

const references = (reference: 'every' | 'first' | 'last' | 'none') =>
  bibleVerseTiles(JOHN, {reference}).map(tile => tile.reference);

describe('bibleVerseTiles reference', () => {
  it('shows the reference on every slide, as every passage did before', () => {
    expect(references('every')).toEqual(['3:34', '3:35', '3:36', '4:1', '4:2']);
  });

  it('shows it on the first slide only', () => {
    expect(references('first')).toEqual([
      '3:34',
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('shows it on the last slide only', () => {
    expect(references('last')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      '4:2',
    ]);
  });

  it('shows it on none', () => {
    expect(references('none')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('bibleVerseTiles split', () => {
  it('makes a slide of each verse by default, as before', () => {
    const tiles = bibleVerseTiles(JOHN, {reference: 'every'});
    expect(tiles.map(tile => tile.label)).toEqual([
      '3:34',
      '3:35',
      '3:36',
      '4:1',
      '4:2',
    ]);
    expect(tiles[0]?.lines).toEqual(['34 a']);
  });

  it('puts two verses on a slide, the last one alone when the count is odd', () => {
    const tiles = bibleVerseTiles(JOHN, {reference: 'last', split: 'two'});
    expect(tiles.map(tile => tile.label)).toEqual([
      '3:34-35',
      '3:36-4:1',
      '4:2',
    ]);
    expect(tiles[0]?.lines).toEqual(['34 a', '35 b']);
    expect(tiles.map(tile => tile.reference)).toEqual([
      undefined,
      undefined,
      '4:2',
    ]);
  });

  it('packs as many verses as fit in the line limit', () => {
    const tiles = bibleVerseTiles(JOHN, {
      reference: 'first',
      split: 'fit',
      maxLines: 3,
    });
    expect(tiles.map(tile => tile.label)).toEqual(['3:34-36', '4:1-2']);
    expect(tiles.map(tile => tile.reference)).toEqual(['3:34-36', undefined]);
  });

  it('keeps a verse that alone passes the line limit on its own slide', () => {
    const long = 'x'.repeat(LIVE_STATE_LIMITS.textCharacters * 3);
    const tiles = bibleVerseTiles(
      passage([
        [1, 1, 'a'],
        [1, 2, long],
        [1, 3, 'c'],
      ]),
      {verseNumbers: false, reference: 'every', split: 'fit', maxLines: 2},
    );
    expect(tiles.map(tile => tile.label)).toEqual(['1:1', '1:2', '1:3']);
  });
});

describe('bibleSource reference', () => {
  it('draws the reference on every slide unless told otherwise, with the old id', () => {
    const source = bibleSource(JOHN);
    expect(source.reference).toBe('every');
    expect(source.id).toBe('bible:sample:요한복음 3:34-4:2');
    expect(source.tiles.map(tile => tile.reference)).toEqual([
      '3:34',
      '3:35',
      '3:36',
      '4:1',
      '4:2',
    ]);
  });

  it('takes the default reference of 환경설정 and tells the sources apart', () => {
    const source = bibleSource(JOHN, {verseNumbers: true, reference: 'last'});
    expect(source.tiles.map(tile => tile.reference)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      '4:2',
    ]);
    expect(source.id).not.toBe(bibleSource(JOHN).id);
  });
});
