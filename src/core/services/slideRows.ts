import {checkPart} from '../schema/fileFormat';
import {createSlideId} from '../schema/ids';
import {SLIDES_LIMITS, slidesSchema} from '../schema/service';
import type {SlideListAdapter} from '../songs/slideListEdits';
import type {Slide, SlidesItem} from './slidesEdits';

/** Validates rows against their destination form, including verse and ad-name restrictions. */
export function slideRowsAdapter(
  form: SlidesItem['slides']['form'],
): SlideListAdapter<Slide> {
  return {
    newId: () => createSlideId(crypto.randomUUID()),
    minSlides: 0,
    maxSlides: SLIDES_LIMITS.slides,
    fromLines: (lines, id) => ({
      id,
      text: lines.join('\n'),
      ...(form === 'ad' ? {name: ''} : {}),
    }),
    toLines: slide =>
      'text' in slide
        ? slide.text.split('\n')
        : 'verse' in slide
          ? [`${slide.verse.book} ${slide.verse.chapter}:${slide.verse.verse}`]
          : [],
    validate: slides => {
      const result = checkPart(slidesSchema, {form, name: '', slides});
      return result.ok
        ? {ok: true, value: result.value.slides}
        : {ok: false, error: 'invalid'};
    },
  };
}
