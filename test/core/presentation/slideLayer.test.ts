import {emptyLayers} from '@core/live/state';
import {themeElementText} from '@core/themes/content';
import {builtInTheme} from '@core/themes/defaults';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {
  newSectionItem,
  sectionCardOf,
  withSectionCard,
} from '@core/services/sectionCards';
import {projectSlides} from '@core/presentation/slides';
import {createServiceItemId} from '@core/schema/ids';
import {describe, expect, it} from 'vitest';
import type {SlideTile} from '@core/presentation/model';
import {nextSlideOf, slideLayerOf} from '@core/presentation/slideLayer';
import {createMediaId, createThemeId} from '@core/schema/ids';

const tiles: Readonly<Record<string, readonly SlideTile[]>> = {
  song: [
    {label: '1절', labelColor: '#5FB8C2', lines: ['a', 'b']},
    {label: null, labelColor: 'none', lines: ['c']},
  ],
};
const tilesOf = (itemId: string): readonly SlideTile[] => tiles[itemId] ?? [];

it('does not treat a song background as a picture-only next slide', () => {
  const tile: SlideTile = {
    label: null,
    labelColor: 'none',
    lines: ['Next lyric'],
    picture: createMediaId('00000000-0000-4000-8000-000000000001'),
  };
  expect(nextSlideOf(tile, 'song', {title: 'Song'})).toMatchObject({
    lines: ['Next lyric'],
  });
  expect(nextSlideOf(tile, 'song', {title: 'Song'})).not.toHaveProperty(
    'title',
  );
});

it('carries the unnumbered projected ad title for same-item and following-item cues', () => {
  const nextAd: SlideTile = {
    label: '3. Anniversary',
    labelColor: 'none',
    kind: 'ad',
    name: '3. Anniversary',
    lines: ['Ad body'],
  };
  const current: SlideTile = {
    label: null,
    labelColor: 'none',
    kind: 'ad',
    name: 'Current',
    lines: ['Current body'],
  };
  const same = slideLayerOf({itemId: 'ad', index: 0}, () => [current, nextAd]);
  expect(same?.next).toMatchObject({
    title: '2. 3. Anniversary',
    adTitle: '3. Anniversary',
    lines: [],
  });
  const cross = slideLayerOf({itemId: 'ad', index: 0}, () => [current], {
    tile: nextAd,
    kind: 'ad',
    textSlideNumber: 1,
  });
  expect(cross?.next).toMatchObject({
    itemKind: 'ad',
    title: '1. 3. Anniversary',
    adTitle: '3. Anniversary',
  });
  const card = {
    label: null,
    labelColor: 'none' as const,
    lines: [],
    sectionCard: {
      name: 'Notice',
      english: 'Notice',
      theme: createThemeId('00000000-0000-4000-8000-000000000124'),
    },
  };
  expect(nextSlideOf(card, 'blank', {after: nextAd})).toMatchObject({
    title: 'Notice',
  });
  expect(nextSlideOf(card, 'blank', {after: nextAd})).not.toHaveProperty(
    'adTitle',
  );
  expect(
    nextSlideOf(
      {...card, sectionCard: {...card.sectionCard, english: ''}},
      'blank',
    ),
  ).not.toHaveProperty('orderTitle');
  const imageAd: SlideTile = {
    label: 'Actual image title',
    labelColor: 'none',
    kind: 'ad',
    lines: [],
    picture: createMediaId('00000000-0000-4000-8000-000000000001'),
  };
  expect(nextSlideOf(imageAd, 'ad', {title: 'Item name'})).toMatchObject({
    adTitle: 'Actual image title',
  });
  const videoAd: SlideTile = {
    kind: 'ad',
    labelColor: 'none',
    lines: [],
    media: {
      mediaId: createMediaId('00000000-0000-4000-8000-000000000002'),
      loop: false,
    },
    label: 'Actual video title',
  };
  expect(nextSlideOf(videoAd, 'ad', {title: 'Item name'})).toMatchObject({
    adTitle: 'Actual video title',
  });
  expect(nextSlideOf(card, 'blank', {after: imageAd})).not.toHaveProperty(
    'adTitle',
  );
  for (const previousKind of ['song', 'blank'] as const) {
    const previous: SlideTile = {
      label: null,
      labelColor: 'none',
      lines: ['Previous'],
      ...(previousKind === 'blank' ? {kind: 'blank' as const} : {}),
    };
    for (const firstAd of [nextAd, imageAd, videoAd]) {
      const beforeCard = slideLayerOf(
        {itemId: 'before', index: 0},
        () => [previous],
        {
          tile: card,
          kind: 'ad',
          after: firstAd,
        },
      );
      expect(beforeCard?.next).toMatchObject({title: 'Notice', lines: []});
      expect(beforeCard?.next).not.toHaveProperty('adTitle');
      const cardLive = slideLayerOf({itemId: 'card', index: 0}, () => [
        card,
        firstAd,
      ]);
      expect(cardLive?.next?.adTitle).toBe(firstAd.label);
      const cardAsSeparateItem = slideLayerOf(
        {itemId: 'card', index: 0},
        () => [card],
        {
          tile: firstAd,
          kind: 'ad',
        },
      );
      expect(cardAsSeparateItem?.next?.adTitle).toBe(firstAd.label);
    }
  }
  expect(
    nextSlideOf({...nextAd, label: 'Edited title', name: 'Old title'}, 'ad', {
      textSlideNumber: 2,
    }),
  ).toMatchObject({adTitle: 'Edited title'});
  expect(
    nextSlideOf({...current, name: ''}, 'ad', {textSlideNumber: 1}).adTitle,
  ).toBe('');
  expect(nextSlideOf({...current, kind: 'blank'}, 'blank')).not.toHaveProperty(
    'adTitle',
  );
});

describe('slideLayerOf', () => {
  it('starts a lyric label again after a title slide with the same name', () => {
    for (const label of ['1절', '나의가사', 'Long custom label']) {
      const deck: readonly SlideTile[] = [
        {label, labelColor: 'none', titleSlide: true, lines: ['Title']},
        {label, labelColor: 'none', lines: ['Lyric']},
      ];
      expect(
        slideLayerOf({itemId: 'song', index: 0}, () => deck)?.next,
      ).not.toHaveProperty('labelContinued');
      expect(
        slideLayerOf({itemId: 'song', index: 1}, () => deck),
      ).not.toHaveProperty('labelContinued');
    }
  });
  it.each(['전주', '간주', '후주'])(
    'continues the %s cue across the title boundary',
    label => {
      const deck: readonly SlideTile[] = [
        {label, labelColor: 'none', titleSlide: true, lines: ['Title']},
        {label, labelColor: 'none', lines: ['Lyric']},
      ];
      expect(
        slideLayerOf({itemId: 'song', index: 0}, () => deck)?.next,
      ).toMatchObject({label, labelContinued: true});
      expect(
        slideLayerOf({itemId: 'song', index: 1}, () => deck),
      ).toMatchObject({label, labelContinued: true});
    },
  );
  it('marks a repeated label only within the same item', () => {
    const deck: readonly SlideTile[] = [
      {label: '1절', labelColor: 'none', lines: ['First']},
      {label: '1절', labelColor: 'none', lines: ['Continued']},
      {label: '후렴', labelColor: 'none', lines: ['Chorus']},
    ];
    expect(
      slideLayerOf({itemId: 'song', index: 0}, () => deck)?.labelContinued,
    ).toBeUndefined();
    expect(
      slideLayerOf({itemId: 'song', index: 1}, () => deck)?.labelContinued,
    ).toBe(true);
    expect(
      slideLayerOf({itemId: 'song', index: 2}, () => deck)?.labelContinued,
    ).toBeUndefined();
    expect(
      slideLayerOf({itemId: 'song', index: 0}, () => deck)?.next,
    ).toMatchObject({label: '1절', labelContinued: true});
    expect(
      slideLayerOf({itemId: 'song', index: 1}, () => deck)?.next,
    ).toMatchObject({label: '후렴'});
    expect(
      slideLayerOf({itemId: 'song', index: 1}, () => deck)?.next
        ?.labelContinued,
    ).toBeUndefined();
    const first = deck[0];
    const following = deck[1];
    if (first === undefined || following === undefined) {
      throw Error('Missing slide');
    }
    const crossing = slideLayerOf({itemId: 'song', index: 0}, () => [first], {
      tile: following,
      kind: 'song',
    });
    expect(crossing?.next?.label).toBe('1절');
    expect(crossing?.next?.labelContinued).toBeUndefined();
  });
  it('carries the main title box line count for current and next slides', () => {
    const deck: readonly SlideTile[] = [
      {
        label: null,
        labelColor: 'none',
        titleSlide: true,
        titleLineCount: 2,
        lines: ['Hymn number', 'Hymn title', 'Subtitle'],
      },
      {
        label: null,
        labelColor: 'none',
        titleSlide: true,
        titleLineCount: 2,
        lines: ['Next number', 'Next title'],
      },
    ];
    expect(slideLayerOf({itemId: 'song', index: 0}, () => deck)).toMatchObject({
      titleLineCount: 2,
      next: {titleLineCount: 2},
    });
  });
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
      bibleItemSlides: [
        {lines: ['가나 (계속)'], continued: true},
        {lines: ['다라'], continued: false},
      ],
    });
    expect(
      slideLayerOf({itemId: 'bible', index: 0}, () => parts)?.bibleItemSlides,
    ).toBe(
      slideLayerOf({itemId: 'bible', index: 1}, () => parts)?.bibleItemSlides,
    );
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

it('shows next slide titles before body for every source kind', () => {
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  const element = builtInTheme('song').screens[stage]?.elements.find(
    value => value.kind === 'nextText',
  );
  if (element?.kind !== 'nextText') throw Error('Missing next text element');
  const section = SUNDAY_SECTIONS[1];
  if (section === undefined) throw Error('Missing section');
  const common = {label: null, labelColor: 'none'} as const;
  const examples: Array<{name: string; tile: SlideTile; expected: string}> = [
    {
      name: 'song',
      tile: {...common, lines: ['Lyric one', 'Lyric two', 'Lyric three']},
      expected: 'Lyric one\nLyric two',
    },
    {
      name: 'titled announcement',
      tile: {
        ...common,
        kind: 'ad',
        name: 'Notice title',
        lines: ['Body one\nBody two'],
      },
      expected: '1. Notice title',
    },
    {
      name: 'titled blank slide',
      tile: {...common, kind: 'blank', name: 'Slide title', lines: ['Body']},
      expected: 'Slide title\nBody',
    },
    {
      name: 'untitled slide',
      tile: {...common, kind: 'blank', lines: ['First\nSecond\nThird']},
      expected: 'First\nSecond',
    },
    {
      name: 'Bible',
      tile: {...common, biblePart: 1, lines: ['Verse one', 'Verse two']},
      expected: 'Verse one\nVerse two',
    },
    {
      name: 'section card',
      tile: {
        ...common,
        sectionCard: sectionCardOf(section),
        lines: ['English subtitle'],
      },
      expected: section.name,
    },
    {
      name: 'media',
      tile: {
        ...common,
        media: {
          mediaId: createMediaId('00000000-0000-4000-8000-000000000001'),
          loop: false,
        },
        lines: [],
      },
      expected: '',
    },
    {
      name: 'picture',
      tile: {
        ...common,
        picture: createMediaId('00000000-0000-4000-8000-000000000001'),
        lines: [],
      },
      expected: '',
    },
  ];
  for (const {name, tile, expected} of examples) {
    const slide = slideLayerOf({itemId: 'item', index: 0}, () => [
      {...common, lines: ['Current']},
      tile,
    ]);
    if (slide === null) throw Error('Missing output');
    expect(
      themeElementText(element, {
        layers: {...emptyLayers(), slide},
        item: null,
      }),
      name,
    ).toBe(expected);
  }
});

it('carries the next item card and its kind without inventing content at the end', () => {
  const section = SUNDAY_SECTIONS[1];
  if (!section) throw Error('Missing section');
  const current = {
    label: null,
    labelColor: 'none',
    lines: ['Current'],
  } as const;
  const card = {
    ...current,
    sectionCard: sectionCardOf(section),
    lines: ['English'],
  };
  const cursor = {itemId: 'song', index: 0};
  expect(slideLayerOf(cursor, () => [current])?.next).toBeUndefined();
  expect(
    slideLayerOf(cursor, () => [current], {tile: card, kind: 'bible'})?.next,
  ).toMatchObject({title: section.name, itemKind: 'bible', lines: []});
});

it.each(SUNDAY_SECTIONS)(
  'shows only the Korean name of the $english section in the stage preview',
  section => {
    const item = newSectionItem(
      createServiceItemId('00000000-0000-4000-8000-000000000001'),
      section,
    );
    const stage = createScreenId(STARTER_SCREEN_IDS.stage);
    const element = builtInTheme('song').screens[stage]?.elements.find(
      value => value.kind === 'nextText',
    );
    if (element?.kind !== 'nextText') throw Error('Missing next text element');
    const tile = withSectionCard(item.sectionCard, projectSlides(item))[0];
    if (!tile) throw Error('Missing section tile');
    const current = {
      label: null,
      labelColor: 'none' as const,
      lines: ['Current'],
    };
    const slide = slideLayerOf({itemId: 'song', index: 0}, () => [current], {
      tile,
      kind: 'blank',
    });
    expect(
      themeElementText(element, {
        layers: {...emptyLayers(), slide},
        item: null,
      }),
    ).toBe(section.name);
  },
);

it('previews the opening song title after a preceding item', () => {
  const current: SlideTile = {
    label: null,
    labelColor: 'none',
    lines: ['Before'],
  };
  const title: SlideTile = {
    label: null,
    labelColor: 'none',
    titleSlide: true,
    lines: ['Song title'],
  };
  const layer = slideLayerOf({itemId: 'before', index: 0}, () => [current], {
    tile: title,
    kind: 'song',
  });
  expect(layer?.next).toMatchObject({
    itemKind: 'song',
    titleSlide: true,
    lines: ['Song title'],
  });
});

it('previews only the opening card name while retaining the card subtitle on output', () => {
  const section = SUNDAY_SECTIONS[1];
  if (!section) throw Error('Missing section');
  const card = {
    label: section.name,
    labelColor: 'none' as const,
    lines: [section.english],
    sectionCard: sectionCardOf(section),
  };
  const content = {
    label: null,
    labelColor: 'none' as const,
    lines: ['First body line\nSecond body line'],
  };
  const current = {
    label: null,
    labelColor: 'none' as const,
    lines: ['Current'],
  };
  const following = {tile: card, kind: 'blank' as const, after: content};
  const slide = slideLayerOf(
    {itemId: 'song', index: 0},
    () => [current],
    following,
  );
  expect(slide?.next).toMatchObject({
    title: section.name,
    orderTitle: section.name,
    lines: [],
  });
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  const element = builtInTheme('song').screens[stage]?.elements.find(
    value => value.kind === 'nextText',
  );
  if (element?.kind !== 'nextText') throw Error('Missing next text element');
  expect(
    themeElementText(element, {layers: {...emptyLayers(), slide}, item: null}),
  ).toBe(section.name);
  const cardSlide = slideLayerOf({itemId: 'card', index: 0}, () => [
    card,
    content,
  ]);
  expect(cardSlide?.lines).toEqual([section.english]);
});

it.each([{name: 'Notice title'}, {name: ''}, {name: '   '}, {name: undefined}])(
  'omits the following slide title and body from the card preview: $name',
  ({name}) => {
    const section = SUNDAY_SECTIONS.find(value => value.english === 'Notice');
    if (!section) throw Error('Missing notice section');
    expect(section.name).toBe('광고');
    const current = {
      label: null,
      labelColor: 'none' as const,
      lines: ['Current'],
    };
    const card = {
      ...current,
      sectionCard: sectionCardOf(section),
      lines: [section.english],
    };
    const content = {
      ...current,
      kind: 'ad' as const,
      ...(name === undefined ? {} : {name}),
      lines: ['First body line\nSecond body line'],
    };
    const slide = slideLayerOf({itemId: 'song', index: 0}, () => [current], {
      tile: card,
      kind: 'ad',
      after: content,
    });
    expect(slide?.next).not.toHaveProperty('orderTitle');
    const stage = createScreenId(STARTER_SCREEN_IDS.stage);
    const element = builtInTheme('song').screens[stage]?.elements.find(
      value => value.kind === 'nextText',
    );
    if (element?.kind !== 'nextText') throw Error('Missing next text element');
    expect(
      themeElementText(element, {
        layers: {...emptyLayers(), slide},
        item: null,
      }),
    ).toBe(section.name);
  },
);

it('previews two numbered notices without their bodies or counting pictures', () => {
  const common = {
    kind: 'ad' as const,
    label: null,
    labelColor: 'none' as const,
  };
  const first = {...common, name: 'First notice', lines: ['First body']};
  const picture = {
    ...common,
    picture: createMediaId('00000000-0000-4000-8000-000000000001'),
    lines: [],
  };
  const second = {...common, name: 'Second notice', lines: ['Second body']};
  const intro: SlideTile = {label: null, labelColor: 'none', lines: ['Intro']};
  const deck = [intro, first, picture, second];
  expect(
    slideLayerOf({itemId: 'ad', index: 0}, () => deck)?.next,
  ).toMatchObject({title: '1. First notice', lines: []});
  expect(
    slideLayerOf({itemId: 'ad', index: 2}, () => deck)?.next,
  ).toMatchObject({title: '2. Second notice', lines: []});
});
