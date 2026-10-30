import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import type {SlideLayer} from '@core/live/state';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {translationIdSchema} from '@core/schema/ids';
import {bibleSource, type BibleSource} from '@core/bible/source';
import {liveTileIndex} from './showLibrary';
import {useShow, type ShowView} from './showStore';

interface PassageFixture {
  readonly book: string;
  readonly first: number;
  readonly last: number;
  readonly translation?: string;
}

function passage({
  book,
  first,
  last,
  translation = 'sample',
}: PassageFixture): BibleLookupPassage {
  const verses = Array.from({length: last - first + 1}, (_, index) => ({
    chapter: 3,
    verse: first + index,
    text: `Invented verse ${first + index}`,
  }));
  return {
    translation: v.parse(translationIdSchema, translation),
    ref: `${book} 3:${first}-${last}`,
    displayRef: `${book} 3:${first}-${last}`,
    verses,
  };
}

function view(open: BibleSource, live: BibleSource): ShowView {
  return {
    ...useShow.getState(),
    bibleSource: open,
    liveBibleSource: live,
    requestedBibleSource: null,
    openItemId: open.id,
  };
}

function liveSlide(source: BibleSource, position: number): SlideLayer {
  return {
    itemId: source.id,
    position,
    label: source.tiles[position]?.label ?? null,
    lines: [],
  };
}

const live = bibleSource(passage({book: '요한복음', first: 16, last: 18}));

describe('liveTileIndex', () => {
  it('returns the live position of the open item', () => {
    expect(liveTileIndex(view(live, live), liveSlide(live, 2))).toBe(2);
  });

  it('finds the live verse in a passage that grew around it', () => {
    const grown = bibleSource(passage({book: '요한복음', first: 15, last: 19}));
    expect(liveTileIndex(view(grown, live), liveSlide(live, 1))).toBe(2);
  });

  it.each([
    [
      'another book',
      bibleSource(passage({book: '창세기', first: 15, last: 19})),
    ],
    [
      'another translation',
      bibleSource(
        passage({book: '요한복음', first: 15, last: 19, translation: 'other'}),
      ),
    ],
    [
      'other verse numbering',
      bibleSource(passage({book: '요한복음', first: 15, last: 19}), {
        verseNumbers: false,
      }),
    ],
    [
      'a passage without the live verse',
      bibleSource(passage({book: '요한복음', first: 18, last: 20})),
    ],
  ])('marks nothing in %s', (_, open) => {
    expect(liveTileIndex(view(open, live), liveSlide(live, 1))).toBeNull();
  });

  it('marks nothing without a live slide or an open item', () => {
    expect(liveTileIndex(view(live, live), null)).toBeNull();
    expect(
      liveTileIndex(
        {...view(live, live), openItemId: null},
        liveSlide(live, 0),
      ),
    ).toBeNull();
  });
});
