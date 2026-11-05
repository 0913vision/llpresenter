import {
  createMediaId,
  createServiceItemId,
  createSlideId,
} from '@core/schema/ids';
import type {ServiceItemOf} from '@core/schema/service';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
export const SLIDE_PICTURE = createMediaId(uuid(901));
export const SLIDES_ITEM = createServiceItemId(uuid(900));

export function slidesItem(
  form: 'blank' | 'ad' = 'ad',
): ServiceItemOf<'slides'> {
  return {
    id: SLIDES_ITEM,
    slides: {
      form,
      name: 'Invented slides',
      advance: 3,
      slides: [
        {
          id: createSlideId(uuid(902)),
          text: 'First line\nSecond line',
          ...(form === 'ad' ? {name: 'Meeting'} : {}),
        },
        {id: createSlideId(uuid(903)), media: SLIDE_PICTURE},
        {id: createSlideId(uuid(904)), text: 'Last line'},
      ],
    },
  };
}
