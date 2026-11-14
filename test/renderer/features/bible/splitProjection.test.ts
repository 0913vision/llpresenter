import {expect, it} from 'vitest';
import {BibleProjections} from '@renderer/features/bible/splitProjection';
import {themeElementText} from '@core/themes/content';
import {emptyLayers} from '@core/live/state';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';

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
        text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa',
      },
      {chapter: 3, verse: 18, text: 'short'},
    ],
  };
  const projections = new BibleProjections({
    themes: null,
    screens: undefined,
    saved: undefined,
    canvas: {font: '', measureText: text => ({width: text.length * 100})},
  });
  const projection = projections.get({
    id: 'labels',
    kind: 'bible',
    source: 'external',
    passage,
    verseNumbers: true,
    translationName: false,
    reference: 'every',
    review: false,
  });
  if (!projection) throw Error('Expected projection');
  const split = projection.parts.filter(part => part.reference.verse === 17);
  expect(split.length).toBeGreaterThan(1);
  expect(
    projection.tiles.slice(0, split.length).map(tile => tile.label),
  ).toEqual(split.map(part => `\uD5693:17 (${part.part})`));
  expect(projection.tiles.at(-1)?.label).toBe('\uD5693:18');
});
