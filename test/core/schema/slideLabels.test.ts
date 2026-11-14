import {expect, it} from 'vitest';
import {checkPart} from '@core/schema/fileFormat';
import {slidesSchema} from '@core/schema/service';
import {slidesItem} from '@fixtures/core/slides';
import {slidesBibleItem} from '@fixtures/core/slidesBible';

it.each(['blank', 'ad'] as const)(
  'accepts capped names on %s text and picture slides',
  form => {
    const item = slidesItem(form).slides;
    const slides = item.slides.map(slide => ({...slide, label: '  Verse  '}));
    const valid = checkPart(slidesSchema, {...item, slides});
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value.slides.map(slide => slide.label)).toEqual([
        'Verse',
        'Verse',
        'Verse',
      ]);
    }
    expect(
      checkPart(slidesSchema, {
        ...item,
        slides: [{...slides[0], label: 'x'.repeat(65)}],
      }).ok,
    ).toBe(false);
    expect(
      checkPart(slidesSchema, {...item, slides: [{...slides[0], label: '  '}]})
        .ok,
    ).toBe(false);
  },
);

it('accepts an optional label on a verse slot', () => {
  const item = slidesBibleItem().slides;
  const slides = item.slides.map(slide => ({...slide, label: 'Verse'}));
  expect(checkPart(slidesSchema, {...item, slides}).ok).toBe(true);
});
