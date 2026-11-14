import {expect, it} from 'vitest';
import {
  createMediaId,
  createServiceItemId,
  createSlideId,
} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {slideLayers} from '@renderer/features/service/slides/SlidesVisuals';
import {projectSlides} from '@core/presentation/slides';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {withSectionCard} from '@core/services/sectionCards';
import {createThemeId} from '@core/schema/ids';

it.each(['blank', 'ad'] as const)(
  'uses the live slide projection for %s text and pictures, including a section card',
  form => {
    const item = newSlidesItem(
      form,
      createServiceItemId('00000000-0000-4000-8000-000000000001'),
    );
    const deck = {
      ...item,
      sectionCard: {
        name: 'Section',
        english: 'Section',
        theme: createThemeId('00000000-0000-4000-8000-000000000111'),
      },
      slides: {
        ...item.slides,
        form,
        slides: [
          {
            id: createSlideId('00000000-0000-4000-8000-000000000011'),
            name: 'Title',
            text: 'First\nSecond',
          },
          {
            id: createSlideId('00000000-0000-4000-8000-000000000012'),
            media: createMediaId('00000000-0000-4000-8000-000000000021'),
          },
        ],
      },
    };
    const tiles = withSectionCard(deck.sectionCard, projectSlides(deck));
    for (const index of [0, 1]) {
      expect(slideLayers(deck, index).slide).toEqual(
        slideLayerOf({itemId: deck.id, index: index + 1}, () => tiles),
      );
    }
  },
);

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
