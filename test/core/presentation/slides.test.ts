import {expect, it} from 'vitest';
import {projectSlides, slidesOutput} from '@core/presentation/slides';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {parseLiveCommand} from '@core/schema/liveCommand';
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
  const tiles = projectSlides(item, undefined, slidesBiblePassages(item));
  expect(tiles[1]).toMatchObject({
    sourceSlideId: VERSE_SLIDE,
    reference: '요한복음 3:16',
    verse: {reference: {book: 43, verse: 16}, text: MOCK_LONG_VERSE},
  });
  expect(tiles[4]).toMatchObject({sourceSlideId: VERSE_REPEAT, label: '3:16'});
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
      'poster.png',
      form === 'ad' ? '' : 'Last line',
    ]);
    const first = slideLayerOf({itemId: item.id, index: 0}, () => tiles);
    expect(first).toMatchObject({
      lines: ['First line\nSecond line'],
      label: null,
      next: {lines: [], label: null},
    });
    expect(first?.name).toBe(form === 'ad' ? 'Meeting' : undefined);
    expect(
      slideLayerOf({itemId: item.id, index: 1}, () => tiles),
    ).toMatchObject({
      picture: SLIDE_PICTURE,
      lines: [],
      next: {lines: ['Last line']},
    });
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
