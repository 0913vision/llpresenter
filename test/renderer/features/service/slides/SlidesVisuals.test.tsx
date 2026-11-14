import {expect, it} from 'vitest';
import {
  createMediaId,
  createServiceItemId,
  createSlideId,
  createThemeId,
} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {slideLayers} from '@renderer/features/service/slides/SlidesVisuals';
import {projectSlides} from '@core/presentation/slides';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {withSectionCard} from '@core/services/sectionCards';

it('previews text-only notice numbers without numbering pictures or blank slides', () => {
  const item = newSlidesItem(
    'ad',
    createServiceItemId('00000000-0000-4000-8000-000000000001'),
  );
  const draft = {
    ...item,
    slides: {
      ...item.slides,
      form: 'ad' as const,
      slides: [
        {
          id: createSlideId('00000000-0000-4000-8000-000000000011'),
          media: createMediaId('00000000-0000-4000-8000-000000000021'),
        },
        {
          id: createSlideId('00000000-0000-4000-8000-000000000012'),
          name: 'First',
          text: 'Body',
        },
        {
          id: createSlideId('00000000-0000-4000-8000-000000000013'),
          name: 'Second',
          text: 'Body',
        },
      ],
    },
  };
  expect(slideLayers(draft, 0).slide?.textSlideNumber).toBeUndefined();
  expect(slideLayers(draft, 1).slide?.textSlideNumber).toBe(1);
  expect(slideLayers(draft, 2).slide?.textSlideNumber).toBe(2);
  const blank = {...draft, slides: {...draft.slides, form: 'blank' as const}};
  expect(slideLayers(blank, 1).slide?.textSlideNumber).toBeUndefined();
});

it('projects picture identity and the opening-card offset like live output', () => {
  const item = newSlidesItem(
    'blank',
    createServiceItemId('00000000-0000-4000-8000-000000000101'),
  );
  const picture = createMediaId('00000000-0000-4000-8000-000000000102');
  const slideId = createSlideId('00000000-0000-4000-8000-000000000103');
  const draft = {
    ...item,
    sectionCard: {
      name: 'Card',
      english: '',
      theme: createThemeId('00000000-0000-4000-8000-000000000111'),
    },
    slides: {...item.slides, slides: [{id: slideId, media: picture}]},
  };
  expect(slideLayers(draft, 0)).toMatchObject({
    slide: {
      itemId: item.id,
      position: 1,
      sequenceLength: 2,
      sourceSlideId: slideId,
      picture,
      kind: 'blank',
    },
    media: {mediaId: picture, slidePicture: true, loop: false},
  });
});

it.each(['blank', 'ad'] as const)(
  'matches the live slide projection for %s text and picture slides',
  form => {
    const item = newSlidesItem(
      form,
      createServiceItemId('00000000-0000-4000-8000-000000000201'),
    );
    const draft = {
      ...item,
      sectionCard: {
        name: 'Card',
        english: '',
        theme: createThemeId('00000000-0000-4000-8000-000000000111'),
      },
      slides: {
        ...item.slides,
        slides: [
          {
            id: createSlideId('00000000-0000-4000-8000-000000000202'),
            name: 'First',
            text: 'First line\nSecond line',
          },
          {
            id: createSlideId('00000000-0000-4000-8000-000000000203'),
            media: createMediaId('00000000-0000-4000-8000-000000000204'),
          },
        ],
      },
    };
    const tiles = withSectionCard(draft.sectionCard, projectSlides(draft));
    for (const index of [0, 1]) {
      expect(slideLayers(draft, index).slide).toEqual(
        slideLayerOf({itemId: draft.id, index: index + 1}, () => tiles),
      );
    }
  },
);
