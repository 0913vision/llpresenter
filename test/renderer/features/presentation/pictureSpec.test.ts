import {expect, it} from 'vitest';
import {createMediaId, createThemeId} from '@core/schema/ids';
import {newSectionCard} from '@core/services/sectionCards';
import {liturgyAsSlides, newLiturgyItem} from '@core/services/liturgy';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {pictureKey} from '@core/output/pictureKey';
import type {SlideTile} from '@core/presentation/model';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {slideTheme} from '@renderer/platform/useSlideTheme';
import {
  biblePictureInput,
  cardPictureLayer,
  pictureSpec,
  slideLayers,
  songPictureLayer,
} from '@renderer/rendering/pictureSpec';
import {outputSlideSpec} from '@renderer/rendering/outputSlideSpec';
import {themeFile, themeScreens} from '@fixtures/core/themeOutput';
import {slidesItem} from '@fixtures/core/slides';

const tiles: ReadonlyArray<[string, SlideTile]> = [
  ['song', {label: 'Verse', labelColor: 'none', lines: ['Song']}],
  ['blank', {label: null, labelColor: 'none', lines: ['Blank'], kind: 'blank'}],
  ['ad', {label: null, labelColor: 'none', lines: ['Notice'], kind: 'ad'}],
  ['bible', {label: '1:1', labelColor: 'none', lines: ['Verse'], biblePart: 1}],
  [
    'sermon',
    {label: null, labelColor: 'none', lines: ['Title'], sermonTitle: true},
  ],
  ['liturgy', {label: null, labelColor: 'none', lines: ['Prayer']}],
  [
    'media',
    {
      label: null,
      labelColor: 'none',
      lines: [],
      media: {
        mediaId: createMediaId('00000000-0000-4000-8000-000000000005'),
        loop: true,
      },
    },
  ],
];

it.each(['audience', 'stage', 'broadcast'] as const)(
  'builds prepared and projected pictures consistently on %s',
  role => {
    const appearance = previewAppearance({
      role,
      themes: themeFile(),
      screens: {
        format: 'llsettings.screens',
        schemaVersion: 1,
        screens: themeScreens,
      },
    });
    const theme = slideTheme(
      {id: 'item', kind: 'song', title: 'Song'},
      {source: 'service', file: themeFile(), screens: themeScreens, role},
    );
    if (theme === undefined) throw new Error('Missing theme');
    for (const [kind, tile] of tiles) {
      const slide = slideLayerOf({itemId: kind, index: 0}, () => [tile]);
      if (slide === null) throw new Error('Missing slide');
      const background = tile.media?.mediaId;
      const input = {
        ...theme,
        slide,
        ...(background === undefined ? {} : {background, mediaOnly: true}),
      };
      const result = pictureSpec({kind: 'slide', input});
      expect(result.kind).toBe(background === undefined ? 'slide' : 'media');
      const direct = result.spec;
      const projectedResult = pictureSpec({
        kind: 'tile',
        tile,
        slide,
        themes: {
          theme,
          cardTheme: undefined,
          sermonTheme: undefined,
          bibleAppearance: undefined,
        },
      });
      expect(projectedResult, kind).toBeDefined();
      if (projectedResult === undefined) throw new Error('Missing picture');
      expect(projectedResult.kind).toBe(
        background === undefined ? 'slide' : 'media',
      );
      const projected = projectedResult.spec;
      expect(pictureKey(projected), kind).toBe(
        pictureKey(outputSlideSpec(input)),
      );
      expect(pictureKey(direct), kind).toBe(pictureKey(projected));
      expect(projected.appearance.screen.kind, kind).toBe(role);
      expect(projected.layers.media?.mediaId, kind).toBe(background);
      expect(projected.layers.slide?.itemId, kind).toBe(
        background === undefined ? kind : undefined,
      );
      const layered = pictureSpec({
        kind: 'layers',
        layers: direct.layers,
        appearance,
      }).spec;
      expect(layered.layers).toBe(direct.layers);
      expect(layered.appearance).toBe(appearance);
    }
  },
);

it('selects card and sermon title themes before the item theme', () => {
  const theme = slideTheme(
    {id: 'item', kind: 'song', title: 'Song'},
    {source: 'service', file: themeFile(), screens: themeScreens},
  );
  if (theme === undefined) throw new Error('Missing theme');
  const cardTheme = {
    ...theme,
    themeId: createThemeId('00000000-0000-4000-8000-000000000101'),
  };
  const sermonTheme = {
    ...theme,
    themeId: createThemeId('00000000-0000-4000-8000-000000000102'),
  };
  const themes = {theme, cardTheme, sermonTheme, bibleAppearance: undefined};
  const card: SlideTile = {
    label: null,
    labelColor: 'none',
    lines: [],
    sectionCard: newSectionCard(),
  };
  const sermon: SlideTile = {
    label: null,
    labelColor: 'none',
    lines: ['Sermon'],
    sermonTitle: true,
  };
  for (const [tile, expected] of [
    [card, cardTheme.themeId],
    [sermon, sermonTheme.themeId],
  ] as const) {
    const slide = slideLayerOf({itemId: 'item', index: 0}, () => [tile]);
    const spec = pictureSpec({kind: 'tile', tile, slide, themes})?.spec;
    expect(spec?.appearance.theme.themeId).toBe(expected);
  }
});

it.each(['audience', 'stage', 'broadcast'] as const)(
  'selects projected slide parts without confusing the leading card on %s',
  role => {
    const base = slidesItem('blank');
    const item = {...base, sectionCard: newSectionCard()};
    const slide = item.slides.slides[0];
    if (slide === undefined) throw new Error('Missing slide');
    const projection = {
      tiles: [
        {
          sourceSlideId: slide.id,
          label: 'first',
          labelColor: 'none' as const,
          lines: ['Part one'],
        },
        {
          sourceSlideId: slide.id,
          label: 'second',
          labelColor: 'none' as const,
          lines: ['Part two'],
        },
      ],
    };
    const appearance = previewAppearance({
      role,
      themes: themeFile(),
      screens: {
        format: 'llsettings.screens',
        schemaVersion: 1,
        screens: themeScreens,
      },
    });
    const spec = pictureSpec({
      kind: 'slides',
      item,
      index: 0,
      part: 1,
      projection,
      appearance,
    }).spec;
    expect(spec.layers.slide?.itemId).toBe(item.id);
    expect(spec.layers.slide?.position).toBe(1);
    expect(spec.layers.slide?.lines).toEqual(['Part two']);
    expect(spec.appearance.screen.kind).toBe(role);
    const card = pictureSpec({kind: 'slides', item, index: 0, appearance}).spec;
    expect(card.layers.slide?.sectionCard).toBeUndefined();
    expect(card.layers.slide?.position).toBe(1);
  },
);

it.each(['blank', 'ad', 'liturgy', 'standby'] as const)(
  'uses the projected %s item with each role and preserves the full layers',
  kind => {
    const blank = slidesItem(kind === 'ad' ? 'ad' : 'blank');
    const item =
      kind === 'liturgy'
        ? liturgyAsSlides(
            newLiturgyItem(blank.id, {kind: 'creed', translation: 'new'}),
          )
        : kind === 'standby'
          ? {...blank, theme: themeFile().standby.id}
          : blank;
    for (const role of ['audience', 'stage', 'broadcast'] as const) {
      const appearance = previewAppearance({
        role,
        themes: themeFile(),
        screens: {
          format: 'llsettings.screens',
          schemaVersion: 1,
          screens: themeScreens,
        },
      });
      const actual = pictureSpec({
        kind: 'slides',
        item,
        index: 0,
        appearance,
      }).spec;
      expect(actual.layers).toEqual(slideLayers(item, 0));
      expect(actual.layers.slide?.itemId).toBe(item.id);
      expect(actual.appearance.screen.kind).toBe(role);
    }
  },
);

it('keeps song identity, text and title attributes across prepared surfaces', () => {
  const song = {
    lines: ['Title', 'Subtitle'],
    label: 'Verse',
    titleSlide: true as const,
    titleLineCount: 2,
  };
  const layer = songPictureLayer('song-item', 3, song);
  expect(layer).toMatchObject({itemId: 'song-item', position: 3, ...song});
  const card = newSectionCard();
  expect(cardPictureLayer('song-item', card)).toEqual({
    itemId: 'song-item',
    position: 0,
    label: card.name,
    lines: [card.english],
    sectionCard: card,
  });
});

it.each(['audience', 'stage', 'broadcast'] as const)(
  'retains the selected Bible theme and screen for %s',
  role => {
    const appearance = previewAppearance({
      role,
      themes: themeFile(),
      screens: {
        format: 'llsettings.screens',
        schemaVersion: 1,
        screens: themeScreens,
      },
    });
    const slide = {
      itemId: 'bible',
      position: 2,
      label: '1:1',
      lines: ['Verse'],
    };
    const input = biblePictureInput(slide, appearance, {
      background: 'asset',
      sourceScreenId: appearance.theme.sourceScreenId,
      audience: appearance.audience,
    });
    const spec = pictureSpec({kind: 'slide', input}).spec;
    expect(spec.layers.slide).toEqual(slide);
    expect(spec.layers.media?.mediaId).toBe('asset');
    expect(spec.appearance.screen.kind).toBe(role);
    expect(spec.appearance.theme.sourceScreenId).toBe(
      appearance.theme.sourceScreenId,
    );
    expect(spec.appearance.audience).toEqual(appearance.audience);
  },
);

it('resolves the requested sequence identity and stage next label from the same tiles', () => {
  const theme = slideTheme(
    {id: 'item', kind: 'song', title: 'Song'},
    {
      source: 'service',
      file: themeFile(),
      screens: themeScreens,
      role: 'stage',
    },
  );
  if (theme === undefined) throw new Error('Missing theme');
  const sequence: readonly SlideTile[] = [
    {label: 'First', labelColor: 'none', lines: ['First words']},
    {label: 'Next', labelColor: 'none', lines: ['Second words']},
  ];
  const themes = {
    theme,
    cardTheme: undefined,
    sermonTheme: undefined,
    bibleAppearance: undefined,
  };
  const first = pictureSpec({
    kind: 'sequence',
    itemId: 'item',
    index: 0,
    tiles: sequence,
    themes,
  });
  const second = pictureSpec({
    kind: 'sequence',
    itemId: 'item',
    index: 1,
    tiles: sequence,
    themes,
  });
  expect(first?.spec.layers.slide).toMatchObject({
    itemId: 'item',
    position: 0,
    label: 'First',
    next: {label: 'Next', lines: ['Second words']},
  });
  expect(second?.spec.layers.slide).toMatchObject({
    itemId: 'item',
    position: 1,
    label: 'Next',
  });
  expect(second?.spec.layers.slide?.next).toBeUndefined();
  expect(
    pictureSpec({
      kind: 'sequence',
      itemId: 'item',
      index: 2,
      tiles: sequence,
      themes,
    }),
  ).toBeUndefined();
});
