import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {bibleVerseTiles, labelEdge} from '@core/bible/bibleTiles';
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
  it.each([
    ['요한복음', 'John'],
    ['요한일서', '1 John'],
    ['아가', 'Song of Solomon'],
  ])(
    'keeps the localized full book name %s as %s on each slide',
    (canonical, localized) => {
      const value = {
        ...JOHN,
        ref: `${canonical} 3:16-4:2`,
        displayRef: `${localized} 3:16-4:2`,
        translationLabel: 'KJV',
        verses: passage([
          [3, 16, 'a'],
          [3, 17, 'b'],
          [3, 18, 'c'],
          [4, 1, 'd'],
          [4, 2, 'e'],
        ]).verses,
      };
      const tiles = bibleVerseTiles(value, {
        reference: 'every',
        split: 'two',
        translationName: true,
      });
      expect(tiles.map(tile => tile.reference)).toEqual([
        `${localized} 3:16~17 (KJV)`,
        `${localized} 3:18~4:1 (KJV)`,
        `${localized} 4:2 (KJV)`,
      ]);
      expect(tiles.map(tile => tile.label)).toEqual([
        '3:16-17',
        '3:18-4:1',
        '4:2',
      ]);
      expect(bibleVerseTiles(value, {reference: 'first'})[0]?.reference).toBe(
        `${localized} 3:16`,
      );
    },
  );

  it.each(['every', 'first', 'last', 'none'] as const)(
    'uses each slide range and appends the enabled translation with %s',
    reference => {
      const value = {...JOHN, translationLabel: '개역한글'};
      for (const translationName of [false, true]) {
        const tiles = bibleVerseTiles(value, {
          split: 'two',
          reference,
          translationName,
        });
        const suffix = translationName ? ' (개역한글)' : '';
        const expected = [
          '요한복음 3:34~35',
          '요한복음 3:36~4:1',
          '요한복음 4:2',
        ];
        expect(tiles.map(tile => tile.reference)).toEqual(
          expected.map((text, index) =>
            reference === 'every' ||
            (reference === 'first' && index === 0) ||
            (reference === 'last' && index === 2)
              ? text + suffix
              : undefined,
          ),
        );
        expect(tiles.map(tile => tile.label)).toEqual([
          '3:34-35',
          '3:36-4:1',
          '4:2',
        ]);
      }
    },
  );

  it('uses the full numbered book name and tolerates missing translation metadata', () => {
    const value = {
      ...JOHN,
      ref: '요한일서 3:34-4:2',
      displayRef: '요한일서 3:34-4:2',
    };
    expect(
      bibleVerseTiles(value, {reference: 'every', translationName: true})[0]
        ?.reference,
    ).toBe('요한일서 3:34');
    expect(
      bibleVerseTiles(JOHN, {reference: 'every', split: 'fit', maxLines: 5})[0]
        ?.reference,
    ).toBe('요한복음 3:34~4:2');
  });
  it('shows the reference on every slide, as every passage did before', () => {
    expect(references('every')).toEqual([
      '요한복음 3:34',
      '요한복음 3:35',
      '요한복음 3:36',
      '요한복음 4:1',
      '요한복음 4:2',
    ]);
  });

  it('shows it on the first slide only', () => {
    expect(references('first')).toEqual([
      '요한복음 3:34',
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
      '요한복음 4:2',
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
      '요한복음 4:2',
    ]);
  });

  it('packs as many verses as fit in the line limit', () => {
    const tiles = bibleVerseTiles(JOHN, {
      reference: 'first',
      split: 'fit',
      maxLines: 3,
    });
    expect(tiles.map(tile => tile.label)).toEqual(['3:34-36', '4:1-2']);
    expect(tiles.map(tile => tile.reference)).toEqual([
      '요한복음 3:34~36',
      undefined,
    ]);
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
  it('keeps translation visibility in the source identity and leaves it off by default', () => {
    const value = {...JOHN, translationLabel: '개역한글'};
    const plain = bibleSource(value);
    const named = bibleSource(value, {
      verseNumbers: true,
      translationName: true,
    });
    expect(plain.translationName).toBe(false);
    expect(named.id).not.toBe(plain.id);
    expect(named.tiles[0]?.reference).toBe('요한복음 3:34 (개역한글)');
  });
  it('draws the reference on every slide unless told otherwise, with the old id', () => {
    const source = bibleSource(JOHN);
    expect(source.reference).toBe('every');
    expect(source.id).toBe('bible:sample:요한복음 3:34-4:2');
    expect(source.tiles.map(tile => tile.reference)).toEqual([
      '요한복음 3:34',
      '요한복음 3:35',
      '요한복음 3:36',
      '요한복음 4:1',
      '요한복음 4:2',
    ]);
  });

  it('takes the default reference of 환경설정 and tells the sources apart', () => {
    const source = bibleSource(JOHN, {verseNumbers: true, reference: 'last'});
    expect(source.tiles.map(tile => tile.reference)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      '요한복음 4:2',
    ]);
    expect(source.id).not.toBe(bibleSource(JOHN).id);
  });
});

describe('labelEdge', () => {
  it('reads the first and the last verse of every label the builder writes', () => {
    const labels = bibleVerseTiles(JOHN, {split: 'two'}).map(
      tile => tile.label,
    );
    expect(labels).toEqual(['3:34-35', '3:36-4:1', '4:2']);
    expect(labels.map(label => labelEdge(label, 'first'))).toEqual([
      '3:34',
      '3:36',
      '4:2',
    ]);
    expect(labels.map(label => labelEdge(label, 'last'))).toEqual([
      '3:35',
      '4:1',
      '4:2',
    ]);
    expect(labelEdge('3:34-36', 'last')).toBe('3:36');
  });

  it('has no edge for no label', () => {
    expect(labelEdge(undefined, 'first')).toBeUndefined();
    expect(labelEdge(null, 'last')).toBeUndefined();
  });
});
