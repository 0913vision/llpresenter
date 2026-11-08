import {expect, it} from 'vitest';
import {
  createMediaId,
  createServiceItemId,
  createSlideId,
} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {slideLayers} from '@renderer/features/service/slides/SlidesVisuals';

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
