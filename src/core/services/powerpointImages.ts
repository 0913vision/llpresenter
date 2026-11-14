import {createServiceItemId, createSlideId, type MediaId} from '../schema/ids';
import type {ServiceItemOf} from '../schema/service';
import {SLIDES_LIMITS} from '../schema/service';
import {IMAGE_SLIDES_THEME_ID} from '../themes/defaults';

/** Builds one ordered picture item from a completed PowerPoint export. */
export function powerpointImageItem(
  fileName: string,
  media: readonly MediaId[],
): ServiceItemOf<'slides'> {
  return {
    id: createServiceItemId(crypto.randomUUID()),
    theme: IMAGE_SLIDES_THEME_ID,
    slides: {
      form: 'blank',
      name: fileName.replace(/\.[^.]+$/, '').slice(0, SLIDES_LIMITS.name),
      slides: media.map(id => ({
        id: createSlideId(crypto.randomUUID()),
        media: id,
      })),
    },
  };
}
