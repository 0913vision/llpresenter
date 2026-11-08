import {expect, it} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {themeElementText, themeElementMedia} from '@core/themes/content';

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
