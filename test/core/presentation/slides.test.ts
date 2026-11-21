import {expect, it} from 'vitest';
import {
  colorSlideLabels,
  projectSlides,
  slidesOutput,
} from '@core/presentation/slides';
import {nextSlideOf, slideLayerOf} from '@core/presentation/slideLayer';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {manualSlideTextKey} from '@core/schema/slideTextOverrides';
import {AD_THEME_ID} from '@core/themes/defaults';
import {createThemeId} from '@core/schema/ids';
import {
  themeElementBase,
  themeFile,
  themeScreens,
  THEME_MAIN,
} from '@fixtures/core/themeOutput';
import {slidesItem, SLIDE_PICTURE, SLIDES_ITEM} from '@fixtures/core/slides';
import {MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {
  slidesBibleItem,
  slidesBiblePassages,
  VERSE_SLIDE,
  VERSE_REPEAT,
} from '@fixtures/core/slidesBible';

it('resolves verse slots without changing their source identities or storing text in the service item', () => {
  const item = slidesBibleItem();
  const tiles = projectSlides(item, undefined, {
    passages: slidesBiblePassages(item),
  });
  expect(tiles[1]).toMatchObject({
    sourceSlideId: VERSE_SLIDE,
    reference: '요한복음 3:16',
    verse: {reference: {book: 43, verse: 16}, text: MOCK_LONG_VERSE},
  });
  expect(tiles[4]).toMatchObject({
    sourceSlideId: VERSE_REPEAT,
    label: '요3:16',
  });
  expect(tiles[1]?.lines.join('')).toBe(tiles[1]?.verse?.text);
  expect(projectSlides(item)[1]?.verse).not.toHaveProperty('text');
  expect(item.slides.slides[1]).not.toHaveProperty('text');
});

it.each(['blank', 'ad'] as const)(
  'projects %s slide bands and keeps pictures out of text',
  form => {
    const item = slidesItem(form);
    const tiles = projectSlides(
      item,
      new Map([
        [
          SLIDE_PICTURE,
          {
            id: SLIDE_PICTURE,
            name: 'Display name',
            kind: 'image',
            file: 'C:\\data\\poster.png',
            size: 1,
          },
        ],
      ]),
    );
    expect(tiles.map(tile => tile.label)).toEqual([
      form === 'ad' ? 'Meeting' : 'First line',
      form === 'ad' ? item.slides.name : 'poster.png',
      form === 'ad' ? item.slides.name : 'Last line',
    ]);
    const first = slideLayerOf({itemId: item.id, index: 0}, () => tiles);
    expect(first).toMatchObject({
      lines: ['First line\nSecond line'],
      label: form === 'ad' ? 'Meeting' : null,
      next: {lines: [], label: form === 'ad' ? item.slides.name : null},
    });
    expect(first?.name).toBe(form === 'ad' ? 'Meeting' : undefined);
    expect(
      slideLayerOf({itemId: item.id, index: 1}, () => tiles),
    ).toMatchObject({
      picture: SLIDE_PICTURE,
      lines: [],
      next: form === 'ad' ? {lines: [], title: '2.'} : {lines: ['Last line']},
    });
    expect(
      slideLayerOf({itemId: item.id, index: 2}, () => tiles)?.lines,
    ).toEqual(['Last line']);
  },
);

it('sends a picture atomically and applies the item background on text', () => {
  const tiles = projectSlides(slidesItem());
  const picture = slideLayerOf({itemId: SLIDES_ITEM, index: 1}, () => tiles);
  const text = slideLayerOf({itemId: SLIDES_ITEM, index: 2}, () => tiles);
  if (picture === null || text === null) throw Error('Missing fixture slide');
  const command = slidesOutput(picture, undefined);
  expect(command.commands).toEqual([
    {
      type: 'media.show',
      media: {
        mediaId: SLIDE_PICTURE,
        loop: false,
        itemId: SLIDES_ITEM,
        slidePicture: true,
      },
    },
    {type: 'slide.show', slide: picture},
  ]);
  expect(parseLiveCommand(command).ok).toBe(true);
  const background = {mediaId: SLIDE_PICTURE, loop: true};
  expect(slidesOutput(text, background).commands[0]).toEqual({
    type: 'media.show',
    media: background,
  });
  expect(slidesOutput(text, undefined).commands).toEqual([
    {type: 'slide.show', slide: text},
  ]);
});

it('routes a song slide picture as a background while keeping the lyrics', () => {
  const slide = {
    itemId: SLIDES_ITEM,
    position: 0,
    label: null,
    lines: ['Lyric'],
    picture: SLIDE_PICTURE,
  };
  expect(slidesOutput(slide, undefined).commands).toEqual([
    {type: 'media.show', media: {mediaId: SLIDE_PICTURE, loop: true}},
    {type: 'slide.show', slide},
  ]);
});

it('projects a title on a blank text slide for the next preview', () => {
  const item = slidesItem('blank');
  const first = item.slides.slides[0];
  if (first === undefined || !('text' in first)) {
    throw Error('Missing text slide');
  }
  const titled = {
    ...item,
    slides: {
      ...item.slides,
      slides: [{...first, name: 'Title'}, ...item.slides.slides.slice(1)],
    },
  };
  expect(projectSlides(titled)[0]?.name).toBe('Title');
});

it('marks only a trailing continuation on a referenced text slide', () => {
  const item = slidesItem('blank');
  const reference = '하박국 3:17~19';
  const tiles = projectSlides({
    ...item,
    slides: {
      ...item.slides,
      slides: item.slides.slides.map(({id}, index) => {
        if (index === 0) return {id, text: '말씀(계속) \n', reference};
        if (index === 1) return {id, text: '(계속) 말씀', reference};
        return {id, text: '공지 (계속)'};
      }),
    },
  });
  expect(tiles.map(({lines, continued}) => ({lines, continued}))).toEqual([
    {lines: ['말씀(계속)'], continued: true},
    {lines: ['(계속) 말씀'], continued: undefined},
    {lines: ['공지 (계속)'], continued: undefined},
  ]);
});

it('projects assigned labels and colors on blank text and image slides', () => {
  const item = slidesItem('blank');
  const labeled = {
    ...item,
    slides: {
      ...item.slides,
      slides: item.slides.slides.map((slide, index) => ({
        ...slide,
        label: index === 0 ? 'Verse' : 'Chorus',
      })),
    },
  };
  const tiles = colorSlideLabels(
    projectSlides(labeled),
    new Map([
      ['Verse', '#FF0000'],
      ['Chorus', '#0000FF'],
    ]),
  );
  expect(tiles[0]).toMatchObject({
    label: 'Verse',
    slideLabel: 'Verse',
    labelColor: '#FF0000',
  });
  expect(tiles[1]).toMatchObject({
    label: 'Chorus',
    slideLabel: 'Chorus',
    labelColor: '#0000FF',
    picture: SLIDE_PICTURE,
  });
  expect(slideLayerOf({itemId: item.id, index: 0}, () => tiles)).toMatchObject({
    label: 'Verse',
    next: {label: 'Chorus'},
  });
  expect(slideLayerOf({itemId: item.id, index: 1}, () => tiles)).toMatchObject({
    label: 'Chorus',
  });
});

it('uses saved ad titles for each slide band and the current and next stage labels', () => {
  const item = slidesItem('ad');
  const first = item.slides.slides[0];
  const second = item.slides.slides[2];
  if (!first || !('text' in first) || !second || !('text' in second)) {
    throw Error('Missing ad text slides');
  }
  const title = {
    mode: 'manual',
    role: 'slideName',
    sourceThemeId: AD_THEME_ID,
    slotId: 'slideName',
    text: 'A renamed ad title that is longer than the 64-character explicit slide label limit',
  } as const;
  const saved = {
    ...item,
    slides: {
      ...item.slides,
      slides: [
        {...first, label: 'Obsolete explicit label'},
        {...second, name: 'Second saved name', label: 'Another old label'},
      ],
    },
    textOverrides: {
      [`slide:${first.id}`]: {
        [manualSlideTextKey(title)]: title,
        label: 'Obsolete theme label',
      },
      [`slide:${second.id}`]: {slideName: 'Older saved ad title'},
    },
  };
  const tiles = projectSlides(saved);
  expect(tiles.map(tile => tile.label)).toEqual([
    title.text,
    'Older saved ad title',
  ]);
  expect(tiles.every(tile => tile.slideLabel === undefined)).toBe(true);
  expect(slideLayerOf({itemId: item.id, index: 0}, () => tiles)).toMatchObject({
    label: title.text,
    lines: [first.text],
    next: {label: 'Older saved ad title'},
  });
  const firstTile = tiles[0];
  if (firstTile === undefined) throw Error('Missing projected ad');
  expect(nextSlideOf(firstTile, 'ad')).toMatchObject({
    itemKind: 'ad',
    label: title.text,
  });
});

it('uses a custom default ad theme and its screen-scoped title bindings', () => {
  const item = slidesItem('ad');
  const first = item.slides.slides[0];
  const second = item.slides.slides[2];
  if (!first || !second) throw Error('Missing ad slides');
  const theme = createThemeId('00000000-0000-4000-8000-000000005400');
  const title = {
    ...themeElementBase(),
    kind: 'slideName',
    textSlot: {slotId: 'ad-title', role: 'slideName', scope: 'screen'},
  } as const;
  const legacy = [theme, THEME_MAIN, title.id].join('/');
  const exact = {
    mode: 'manual',
    role: 'slideName',
    sourceThemeId: theme,
    screenId: THEME_MAIN,
    slotId: title.textSlot.slotId,
    text: 'Exact title',
  } as const;
  const defaults = themeFile();
  const adTitleSettings = {
    screens: themeScreens,
    file: {
      ...defaults,
      defaults: {...defaults.defaults, ad: theme},
      themes: [
        ...defaults.themes,
        {
          id: theme,
          name: 'Custom ad',
          screens: {
            [THEME_MAIN]: {mode: {kind: 'own' as const}, elements: [title]},
          },
        },
      ],
    },
  };
  const saved = {
    ...item,
    textOverrides: {
      [`slide:${first.id}`]: {[legacy]: 'Screen-scoped legacy title'},
      [`slide:${second.id}`]: {
        [legacy]: 'Old title',
        [manualSlideTextKey(exact)]: exact,
      },
    },
  };
  const tiles = projectSlides(saved, undefined, {adTitleSettings});
  expect(tiles.map(tile => tile.label)).toEqual([
    'Screen-scoped legacy title',
    item.slides.name,
    'Exact title',
  ]);
});
