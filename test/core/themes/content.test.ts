import {expect, it} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {themeElementText, themeElementMedia} from '@core/themes/content';
import {createMediaId} from '@core/schema/ids';

it('draws the prepared text-slide number only for ads, without guessing from the deck position', () => {
  const element = {...themeElementBase(), kind: 'slideNumber'} as const;
  const slide = {
    itemId: 'ad',
    position: 4,
    label: null,
    lines: ['Body'],
    textSlideNumber: 3,
  };
  const item = {id: 'ad', kind: 'ad', source: 'service'} as const;
  const content = {item, layers: {...emptyLayers(), slide}};
  expect(themeElementText(element, content)).toBe('3');
  expect(
    themeElementText(element, {...content, layers: emptyLayers()}),
  ).toBeNull();
  for (const kind of ['song', 'bible', 'blank', 'media'] as const) {
    expect(
      themeElementText(element, {...content, item: {...item, kind}}),
    ).toBeNull();
  }
  const {textSlideNumber: _number, ...unnumbered} = slide;
  expect(
    themeElementText(element, {
      ...content,
      layers: {...content.layers, slide: unnumbered},
    }),
  ).toBeNull();
  expect(
    themeElementText(element, {
      ...content,
      layers: {
        ...content.layers,
        slide: {
          ...slide,
          picture: createMediaId('00000000-0000-4000-8000-000000000001'),
        },
      },
    }),
  ).toBeNull();
});

it('can keep the item passage range on every Bible slide while preserving the slide source', () => {
  const reference = {...themeElementBase(), kind: 'reference'} as const;
  const item = {
    id: 'bible',
    kind: 'bible',
    source: 'service',
    title: 'Book 11:29~30',
  } as const;
  for (const verse of [29, 30]) {
    const layers = {
      ...emptyLayers(),
      slide: {
        itemId: item.id,
        position: verse - 29,
        label: null,
        lines: ['Verse'],
        reference: `Book 11:${verse}`,
      },
    };
    expect(themeElementText(reference, {layers, item})).toBe(
      `Book 11:${verse}`,
    );
    expect(
      themeElementText({...reference, source: 'slide'}, {layers, item}),
    ).toBe(`Book 11:${verse}`);
    expect(
      themeElementText({...reference, source: 'item'}, {layers, item}),
    ).toBe(item.title);
    const {title: _title, ...untitled} = item;
    expect(
      themeElementText(
        {...reference, source: 'item'},
        {layers, item: untitled},
      ),
    ).toBe(`Book 11:${verse}`);
    expect(
      themeElementText(
        {...reference, source: 'item'},
        {layers, item: {...item, kind: 'blank'}},
      ),
    ).toBe(`Book 11:${verse}`);
  }
  expect(
    themeElementText(
      {...reference, source: 'item'},
      {layers: emptyLayers(), item},
    ),
  ).toBeNull();
});

it('draws the live slide name and leaves unnamed or picture slides empty', () => {
  const element = {...themeElementBase(), kind: 'slideName'} as const;
  const layers = {
    ...emptyLayers(),
    slide: {
      itemId: 'item',
      position: 0,
      label: null,
      lines: ['Body'],
      name: 'News',
    },
  };
  expect(themeElementText(element, {layers, item: null})).toBe('News');
  expect(
    themeElementText(element, {layers: emptyLayers(), item: null}),
  ).toBeNull();
  const {name: _name, ...slide} = layers.slide;
  expect(
    themeElementText(element, {layers: {...layers, slide}, item: null}),
  ).toBeNull();
});

it.each(['blank', 'ad'] as const)(
  'routes a %s picture to media and its background to background',
  kind => {
    const item = {id: 'slides', kind, source: 'service'} as const;
    const background = {mediaId: 'picture', loop: true, startedAt: 0};
    const content = {
      item,
      layers: {
        ...emptyLayers(),
        media: {...background, itemId: item.id, slidePicture: true as const},
      },
    };
    expect(themeElementMedia('media', content)).toEqual(content.layers.media);
    expect(themeElementMedia('background', content)).toBeNull();
    const text = {item, layers: {...emptyLayers(), media: background}};
    expect(themeElementMedia('media', text)).toBeNull();
    expect(themeElementMedia('background', text)).toEqual(background);
  },
);

it('keeps flagged output slide pictures in media without a matching theme item', () => {
  const media = {
    mediaId: 'picture',
    loop: false,
    startedAt: 0,
    slidePicture: true as const,
  };
  const content = {item: null, layers: {...emptyLayers(), media}};
  expect(themeElementMedia('media', content)).toEqual(media);
  expect(themeElementMedia('background', content)).toBeNull();
});

it('resolves timed and stage content and keeps the stage timer and message through a clear', () => {
  const content = {
    layers: emptyLayers(),
    item: {id: 'song', kind: 'song', source: 'service'} as const,
    stageMessage: 'Stage message',
    timer: '1:23',
    clock: '12:00',
    videoTimeLeft: '0:42',
  };
  const cleared = {...content, item: {...content.item, contentCleared: true}};
  const video = {...themeElementBase(), kind: 'videoTimeLeft'} as const;
  expect(themeElementText(video, content)).toBe('0:42');
  expect(themeElementText(video, cleared)).toBeNull();
  const kept = [
    [{...themeElementBase(), kind: 'stageMessage'} as const, 'Stage message'],
    [{...themeElementBase(), kind: 'timer'} as const, '1:23'],
  ] as const;
  for (const [element, text] of kept) {
    expect(themeElementText(element, content)).toBe(text);
    expect(themeElementText(element, cleared)).toBe(text);
  }
  expect(
    themeElementText(
      {...themeElementBase(), kind: 'text', content: 'Fixed'},
      cleared,
    ),
  ).toBe('Fixed');
  expect(
    themeElementText(
      {...themeElementBase(), kind: 'clock', clockFormat: '24h'},
      cleared,
    ),
  ).toBe('12:00');
});

it('limits built-in stage next lines and resolves stage bar data without changing ordinary text', () => {
  const layers = {
    ...emptyLayers(),
    slide: {
      itemId: 'song',
      position: 1,
      sequenceLength: 6,
      label: 'Verse',
      lines: ['Current'],
      next: {label: 'Next', lines: ['First', 'Second', 'Third', 'Fourth']},
    },
  };
  const item = {
    id: 'song',
    kind: 'song',
    source: 'service',
    title: 'Song',
  } as const;
  const next = {
    ...themeElementBase(),
    kind: 'nextText',
    text: {...themeElementBase().text, maxLines: 2},
  } as const;
  expect(themeElementText({...next, lineLimit: 2}, {layers, item})).toBe(
    'First\nSecond',
  );
  expect(themeElementText(next, {layers, item})).toBe(
    'First\nSecond\nThird\nFourth',
  );
  const text = {
    ...themeElementBase(),
    kind: 'text',
    content: 'Literal',
  } as const;
  expect(
    themeElementText({...text, stageSource: 'stageItemName'}, {layers, item}),
  ).toBe('Song');
  expect(
    themeElementText({...text, stageSource: 'stagePosition'}, {layers, item}),
  ).toBe('2 / 6');
  expect(themeElementText(text, {layers, item})).toBe('Literal');
});

it('suppresses a redundant built-in stage label while keeping distinct and saved labels', () => {
  const label = {
    ...themeElementBase(),
    kind: 'label',
    hideWhenItemTitle: true,
  } as const;
  const item = {
    id: 'item',
    kind: 'song',
    source: 'service',
    title: 'Creed',
  } as const;
  const slide = {itemId: item.id, position: 0, label: 'Creed', lines: ['Text']};
  const layers = {...emptyLayers(), slide};
  expect(themeElementText(label, {layers, item})).toBeNull();
  expect(
    themeElementText({...label, hideWhenItemTitle: false}, {layers, item}),
  ).toBe('Creed');
  for (const distinct of ['1 Verse', 'Chorus', '3:16']) {
    expect(
      themeElementText(label, {
        layers: {...layers, slide: {...slide, label: distinct}},
        item,
      }),
    ).toBe(distinct);
  }
  expect(
    themeElementText(label, {
      layers: {...layers, slide: {...slide, label: null}},
      item,
    }),
  ).toBeNull();
  expect(
    themeElementText(label, {
      layers: {...layers, slide: {...slide, title: 'Creed'}},
      item: null,
    }),
  ).toBeNull();
});

it('preserves the ordinary slide name outside advertisements', () => {
  const element = {...themeElementBase(), kind: 'slideName'} as const;
  const slide = {
    itemId: 'blank',
    position: 0,
    label: null,
    lines: ['Body'],
    name: 'Title',
    kind: 'blank' as const,
  };
  expect(
    themeElementText(element, {layers: {...emptyLayers(), slide}, item: null}),
  ).toBe('Title');
});

it('shows preparation fallback only for a live blank slide', () => {
  const element = {
    ...themeElementBase(),
    kind: 'currentText',
    fallbackText: 'Prepare',
  } as const;
  const slide = {itemId: 'item', position: 0, label: null, lines: ['']};
  expect(
    themeElementText(element, {layers: emptyLayers(), item: null}),
  ).toBeNull();
  expect(
    themeElementText(element, {layers: {...emptyLayers(), slide}, item: null}),
  ).toBe('Prepare');
  expect(
    themeElementText(element, {
      layers: {...emptyLayers(), slide: {...slide, lines: ['Edited']}},
      item: null,
    }),
  ).toBe('Edited');
});

it('shares the audience Bible reference with the built-in stage label and respects slide visibility', () => {
  const label = {
    ...themeElementBase(),
    kind: 'label',
    hideWhenItemTitle: true,
  } as const;
  const reference = {
    ...themeElementBase(),
    kind: 'reference',
    source: 'item',
  } as const;
  const item = {
    id: 'bible',
    kind: 'bible',
    source: 'service',
    title: '마태복음 11:29~30',
  } as const;
  const slide = {
    itemId: item.id,
    position: 0,
    label: '11:29',
    lines: ['Verse'],
    reference: '마태복음 11:29',
  };
  const content = {item, layers: {...emptyLayers(), slide}};
  expect(themeElementText(label, content)).toBe('마태복음 11:29~30');
  expect(themeElementText(label, content)).toBe(
    themeElementText(reference, content),
  );
  const {reference: _reference, ...hidden} = slide;
  const noReference = {...content, layers: {...content.layers, slide: hidden}};
  expect(themeElementText(label, noReference)).toBeNull();
  expect(themeElementText(reference, noReference)).toBeNull();
  expect(
    themeElementText(label, {...content, item: {...item, kind: 'song'}}),
  ).toBe('11:29');
});
