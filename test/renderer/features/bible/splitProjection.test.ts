import {projectSlides} from '@core/presentation/slides';
import {slidesBibleItem, slidesBiblePassages} from '@fixtures/core/slidesBible';
import {expect, it} from 'vitest';
import {
  BibleProjections,
  projectBible,
} from '@renderer/features/bible/splitProjection';
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {themeElementText} from '@core/themes/content';
import {emptyLayers} from '@core/live/state';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {QUICK_BIBLE_TRANSITION} from '@core/bible/quickTransition';
import {cacheKey, entryFor} from '@core/bible/split/splitCache';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {
  bibleTextSlideKey,
  textSlideKey,
  textVerseKey,
} from '@core/presentation/textOverrides';
import {pinVerseParts} from '@core/bible/split/splitVerses';

it('keeps a removed verse part out of the grid after confirming cuts for another verse', () => {
  const lookup = panelPassage();
  const source = {
    id: 'stored-passage',
    kind: 'bible',
    source: 'service',
    passage: {
      ...lookup,
      verses: [
        {chapter: 3, verse: 16, text: MOCK_LONG_VERSE},
        {chapter: 3, verse: 17, text: 'Short verse'},
      ],
    },
    verseNumbers: false,
    translationName: false,
    reference: 'first',
  } as const;
  const layout = {
    element: {...themeElementBase(), kind: 'currentText' as const},
    layout: mockSplitLayout(),
  };
  const original = projectBible(source, layout);
  const first = original?.verses[0];
  const second = original?.verses[1];
  if (!original || !first || !second) throw Error('Missing split verses');
  const parts = original.parts.filter(part => part.reference.verse === 16);
  const pinned = pinVerseParts(first.text, parts);
  if (!pinned || pinned.length < 2) throw Error('Missing split in first verse');
  const deleted = bibleTextSlideKey(first.reference, 1);
  const saved = {
    ...source,
    pinnedVerses: {[textVerseKey(first.reference)]: pinned},
    deletedSlides: [deleted],
  };
  const beforeReview = projectBible(saved, layout);
  const afterReview = projectBible(
    {
      ...saved,
      cuts: {
        [cacheKey(second.reference)]: entryFor(
          second.text,
          [1],
          '2026-11-19T00:00:00Z',
        ),
      },
    },
    layout,
  );
  if (!afterReview || !beforeReview) {
    throw Error('Missing projection of stored passage');
  }
  expect(afterReview.tiles.map(textSlideKey)).not.toContain(deleted);
  expect(afterReview.tiles[0]?.biblePart).toBe(2);
  expect(afterReview.tiles[0]?.reference).toContain('3:16');
  expect(afterReview.partsByTile[0]).toMatchObject({
    part: 2,
    reference: first.reference,
  });
  expect(
    beforeReview.tiles.filter(tile => tile.bibleVerse?.verse === 17),
  ).toHaveLength(1);
  expect(
    afterReview.tiles.filter(tile => tile.bibleVerse?.verse === 17),
  ).toHaveLength(2);
  expect(
    afterReview.tiles.filter(tile => tile.bibleVerse?.verse === 16),
  ).toEqual(beforeReview.tiles.filter(tile => tile.bibleVerse?.verse === 16));
  expect(afterReview.source).toMatchObject({passage: {ref: lookup.ref}});
});

it('confirms cuts on a new overlapping passage without resplitting the earlier item', () => {
  const passage = panelPassage();
  const overlap = {chapter: 3, verse: 16, text: 'Shared overlapping verse'};
  const first = {
    id: 'first-passage',
    kind: 'bible',
    source: 'service',
    passage: {...passage, verses: [overlap]},
    verseNumbers: false,
    translationName: false,
    reference: 'every',
  } as const;
  const context = {
    themes: null,
    screens: undefined,
    saved: undefined,
    canvas: {
      font: '',
      measureText: (text: string) => ({width: text.length * 30}),
    },
  };
  const before = new BibleProjections(context).get(first);
  const verse = before?.verses[0];
  if (before === null || verse === undefined) throw Error('Missing passage');
  expect(before.tiles).toHaveLength(1);

  const cuts = {
    [cacheKey(verse.reference)]: entryFor(
      verse.text,
      [1],
      '2026-11-19T00:00:00Z',
    ),
  };
  const saved = settingsDocument('bibleCuts', {
    entries: {[passage.translation]: cuts},
  });
  if (saved.name !== 'bibleCuts') throw Error('Missing cuts document');
  const projections = new BibleProjections({...context, saved: saved.value});
  const added = projections.get({
    ...first,
    id: 'added-passage',
    cuts,
    passage: {
      ...passage,
      verses: [overlap, {chapter: 3, verse: 17, text: 'Second verse'}],
    },
  });

  expect(added?.tiles).toHaveLength(3);
  expect(projections.get(first)?.tiles).toEqual(before.tiles);
});

it('keeps the item range in Bible preview compositions without replacing individual verse metadata', () => {
  const passage = panelPassage();
  const projections = new BibleProjections({
    themes: null,
    screens: undefined,
    saved: undefined,
    canvas: {font: '', measureText: text => ({width: text.length * 30})},
  });
  const projection = projections.get({
    id: 'lookup',
    kind: 'bible',
    source: 'external',
    passage,
    verseNumbers: true,
    translationName: false,
    reference: 'every',
    review: false,
  });
  const appearance = projection?.appearance;
  const reference = appearance?.theme.layout.elements.find(
    element => element.kind === 'reference',
  );
  if (
    reference === undefined ||
    appearance === undefined ||
    projection === null
  ) {
    throw Error('Expected a Bible preview');
  }
  expect(appearance.theme.item?.title).toBe(passage.displayRef);
  expect(projection.tiles.length).toBeGreaterThan(1);
  for (const [position, tile] of projection.tiles.entries()) {
    expect(tile.reference).not.toBe(passage.displayRef);
    const slide = {
      itemId: 'lookup',
      position,
      label: null,
      lines: tile.lines,
      ...(tile.reference === undefined ? {} : {reference: tile.reference}),
    };
    expect(
      themeElementText(reference, {
        layers: {...emptyLayers(), slide},
        item: appearance.theme.item,
      }),
    ).toBe(passage.displayRef);
  }
});

it('labels split verse parts and leaves an unsplit verse unnumbered', () => {
  const original = panelPassage();
  const passage = {
    ...original,
    ref: '하박국 3:17-18',
    displayRef: '하박국 3:17-18',
    verses: [
      {
        chapter: 3,
        verse: 17,
        text: MOCK_LONG_VERSE,
      },
      {chapter: 3, verse: 18, text: 'short'},
    ],
  };
  const projection = projectBible(
    {
      id: 'labels',
      kind: 'bible',
      source: 'external',
      passage,
      verseNumbers: true,
      translationName: false,
      reference: 'every',
      review: false,
    },
    {
      element: {...themeElementBase(), kind: 'currentText'},
      layout: mockSplitLayout(),
    },
  );
  if (!projection) throw Error('Expected projection');
  const split = projection.parts.filter(part => part.reference.verse === 17);
  expect(split.length).toBeGreaterThan(1);
  expect(
    projection.tiles.slice(0, split.length).map(tile => tile.label),
  ).toEqual(split.map(part => `합3:17 (${part.part})`));
  expect(projection.tiles.at(-1)?.label).toBe('합3:18');
});

it('applies the quick default to every split part and preserves per-part overrides', () => {
  const passage = {
    ...panelPassage(),
    ref: '하박국 3:17',
    displayRef: '하박국 3:17',
    verses: [{chapter: 3, verse: 17, text: MOCK_LONG_VERSE}],
  };
  const source = {
    id: 'quick',
    kind: 'bible' as const,
    source: 'external' as const,
    passage,
    verseNumbers: true,
    translationName: false,
    reference: 'every' as const,
    transition: QUICK_BIBLE_TRANSITION,
  };
  const options = {
    element: {...themeElementBase(), kind: 'currentText' as const},
    layout: mockSplitLayout(),
  };
  const quick = projectBible(source, options);
  if (!quick) throw Error('Expected projection');
  expect(quick.tiles.length).toBeGreaterThan(1);
  expect(
    quick.tiles.every(
      tile =>
        JSON.stringify(tile.transition) ===
        JSON.stringify({kind: 'wipe', dir: 'left', sec: 0.7}),
    ),
  ).toBe(true);
  const overridden = projectBible(
    {
      ...source,
      labels: [
        {
          verse: {
            translation: passage.translation,
            book: 35,
            chapter: 3,
            verse: 17,
          },
          part: 2,
          label: 'Refrain',
        },
      ],
      transitions: [
        {
          verse: {
            translation: passage.translation,
            book: 35,
            chapter: 3,
            verse: 17,
          },
          part: 2,
          transition: {kind: 'none', sec: 0.7},
        },
      ],
    },
    options,
  );
  expect(overridden?.tiles[0]?.transition).toEqual({
    kind: 'wipe',
    dir: 'left',
    sec: 0.7,
  });
  expect(overridden?.tiles[1]?.transition).toEqual({kind: 'none', sec: 0.7});
  expect(overridden?.tiles[1]?.slideLabel).toBe('Refrain');
  expect(overridden?.tiles[1]?.label).toContain('3:17');
  expect(overridden?.tiles[1]?.bibleVerse).toEqual({
    translation: passage.translation,
    book: 35,
    chapter: 3,
    verse: 17,
  });
  expect(overridden?.tiles[0]?.slideLabel).toBeUndefined();
  const {transition: _default, ...oldSource} = source;
  expect(
    projectBible({...oldSource, source: 'service'}, options)?.tiles.every(
      tile => tile.transition === undefined,
    ),
  ).toBe(true);
});

it('keeps an assigned label while numbering the parts of an inserted verse', () => {
  const item = slidesBibleItem();
  const labeled = {
    ...item,
    slides: {
      ...item.slides,
      slides: item.slides.slides.map(slide =>
        'verse' in slide ? {...slide, label: 'Chorus'} : slide,
      ),
    },
  };
  const input = projectSlides(labeled, undefined, slidesBiblePassages(item));
  const first = input.find(tile => tile.verse !== undefined);
  expect(first?.label).toBe('Chorus');
  const projection = projectBible(
    {
      id: item.id,
      kind: 'slides',
      source: 'service',
      input,
      verseNumbers: true,
      translationName: false,
      reference: 'every',
    },
    {
      element: {...themeElementBase(), kind: 'currentText'},
      layout: mockSplitLayout(),
    },
  );
  if (!projection) throw Error('Expected projection');
  const parts = projection.tiles.filter(
    tile => tile.sourceSlideId === first?.sourceSlideId,
  );
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.map(tile => tile.label)).toEqual(
    parts.map((_, index) => `Chorus (${index + 1})`),
  );
  expect(parts.every(tile => tile.slideLabel === 'Chorus')).toBe(true);
});

it('uses only the cut saved on each blank-slide verse row', () => {
  const passage = panelPassage();
  const reference = {
    translation: passage.translation,
    book: 43,
    chapter: 3,
    verse: 16,
  };
  const text = '가 나 다';
  const local = entryFor(text, [1], '2026-11-20T00:00:00Z');
  const document = settingsDocument('bibleCuts', {
    entries: {
      [reference.translation]: {
        [cacheKey(reference)]: entryFor(text, [1, 2], '2026-11-20T00:01:00Z'),
      },
    },
  });
  if (document.name !== 'bibleCuts') throw Error('Missing cuts fixture');
  const input = {
    label: null,
    labelColor: 'none' as const,
    lines: [],
    verse: {reference, text},
  };
  const projection = projectBible(
    {
      id: 'blank',
      kind: 'slides',
      source: 'service',
      verseNumbers: false,
      reference: 'every',
      translationName: false,
      input: [{...input, verse: {...input.verse, cut: local}}, input],
    },
    {
      element: {...themeElementBase(), kind: 'currentText'},
      layout: mockSplitLayout(),
      saved: document.value,
    },
  );
  expect(projection?.partsByTile.map(part => part?.text)).toEqual([
    '가',
    '나 다',
    '가 나 다',
  ]);
});

it('preserves the sermon title before all measured Bible parts', () => {
  const projection = projectBible(
    {
      id: 'sermon',
      kind: 'bible',
      source: 'service',
      passage: panelPassage(),
      verseNumbers: true,
      translationName: false,
      reference: 'every',
      sermonTitle: 'Sermon',
      sermonOpeningLabel: 'Opening',
      sermonClosingLabel: 'Closing',
      sermonOpeningTransition: {kind: 'wipe', dir: 'left', sec: 1},
      sermonClosingTransition: {kind: 'dissolve', sec: 2},
    },
    {
      element: {...themeElementBase(), kind: 'currentText'},
      layout: mockSplitLayout(),
    },
  );
  expect(projection?.tiles[0]).toMatchObject({
    sermonTitle: true,
    lines: ['Sermon'],
    slideLabel: 'Opening',
  });
  expect(projection?.tiles[0]?.transition).toMatchObject({
    kind: 'wipe',
    sec: 1,
  });
  expect(projection?.tiles.at(-1)).toMatchObject({
    sermonTitle: true,
    lines: ['Sermon'],
    slideLabel: 'Closing',
    transition: {kind: 'dissolve', sec: 2},
  });
  expect(projection?.partsByTile.at(-1)).toBeNull();
  expect(projection?.partsByTile[0]).toBeNull();
  expect(projection?.tiles[1]?.biblePart).toBe(1);
});

it('applies Bible display preferences to verse slides', () => {
  const item = slidesBibleItem();
  const projections = new BibleProjections({
    themes: null,
    screens: undefined,
    saved: undefined,
    canvas: {font: '', measureText: text => ({width: text.length * 30})},
    slideBibleDefaults: {
      verseNumbers: false,
      reference: 'none',
      translationName: true,
    },
  });
  const projection = projections.get({
    id: item.id,
    kind: 'slides',
    source: 'service',
    input: projectSlides(item, undefined, slidesBiblePassages(item)),
    verseNumbers: true,
    reference: 'every',
    translationName: false,
  });
  expect(projection?.source).toMatchObject({
    verseNumbers: false,
    reference: 'none',
    translationName: true,
  });
});

it('projects corrected verse text and keeps both multiline sermon title slides', () => {
  const passage = panelPassage();
  const options = {
    element: {...themeElementBase(), kind: 'currentText' as const},
    layout: mockSplitLayout(),
  };
  const source = {
    id: 'corrected-passage',
    kind: 'bible',
    source: 'service',
    passage: {
      ...passage,
      verses: [{chapter: 3, verse: 16, text: 'Updated text'}],
    },
    sermonTitle: 'Title\r\nSubtitle',
    verseNumbers: false,
    translationName: false,
    reference: 'every',
  } as const;
  const verse = projectBible(source, options)?.verses[0];
  if (verse === undefined) throw Error('Missing verse');
  const stalePart = bibleTextSlideKey(verse.reference, 1);
  const result = projectBible(
    {
      ...source,
      pinnedVerses: {[textVerseKey(verse.reference)]: ['Original ', 'verse']},
      deletedSlides: [stalePart, 'sermon:opening'],
      textOverrides: {
        [stalePart]: {currentText: 'Stale caption'},
        'sermon:closing': {itemName: 'Closing'},
      },
    },
    options,
  );
  expect(result?.tiles.map(tile => [textSlideKey(tile), tile.lines])).toEqual([
    [stalePart, ['Updated text']],
    ['sermon:closing', ['Title', 'Subtitle']],
  ]);
  expect(result?.tiles[0]?.textOverrides).toBeUndefined();
  expect(result?.tiles.at(-1)?.textOverrides).toEqual({itemName: 'Closing'});
});
