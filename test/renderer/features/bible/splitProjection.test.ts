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
    ref: '\uD558\uBC15\uAD6D 3:17-18',
    displayRef: '\uD558\uBC15\uAD6D 3:17-18',
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
  ).toEqual(split.map(part => `\uD5693:17 (${part.part})`));
  expect(projection.tiles.at(-1)?.label).toBe('\uD5693:18');
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
  });
  expect(projection?.tiles[0]?.transition).toMatchObject({
    kind: 'wipe',
    sec: 1,
  });
  expect(projection?.tiles.at(-1)).toMatchObject({
    sermonTitle: true,
    lines: ['Sermon'],
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
