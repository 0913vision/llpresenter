import {describe, expect, it} from 'vitest';
import {templateOrder, ids} from '@fixtures/core/serviceList';
import {lyricsSlide, slideId} from '@fixtures/core/slides';
import {changedPlace} from '@core/services/changedPlace';
import type {ServiceItem} from '@core/schema/services/service';
import type {Slide} from '@core/schema/slides/slide';

function withSlides(
  order: readonly ServiceItem[],
  itemId: string,
  slides: readonly Slide[],
): ServiceItem[] {
  return order.map(item =>
    item.id === itemId && 'slides' in item ? {...item, slides} : item,
  );
}

describe('changed place', () => {
  const base = withSlides(templateOrder, ids.doxology, [
    lyricsSlide(1, '하나'),
    lyricsSlide(2, '둘'),
    lyricsSlide(3, '셋'),
  ]);

  it('finds the slide whose text came back', () => {
    const edited = withSlides(base, ids.doxology, [
      lyricsSlide(1, '하나'),
      lyricsSlide(2, '둘 고침'),
      lyricsSlide(3, '셋'),
    ]);
    expect(changedPlace(edited, base)).toEqual({
      itemId: ids.doxology,
      slideId: slideId(2),
    });
  });

  it('finds a slide that comes back after it was deleted', () => {
    const deleted = withSlides(base, ids.doxology, [
      lyricsSlide(1, '하나'),
      lyricsSlide(3, '셋'),
    ]);
    expect(changedPlace(deleted, base)).toEqual({
      itemId: ids.doxology,
      slideId: slideId(2),
    });
  });

  it('finds an item that comes back, and the first of two swapped items', () => {
    const removed = base.filter(item => item.id !== ids.nearer);
    expect(changedPlace(removed, base)).toEqual({itemId: ids.nearer});
    const [first, second, third, ...rest] = base;
    if (!first || !second || !third) throw new Error('Missing sample items');
    expect(changedPlace([first, third, second, ...rest], base)?.itemId).toBe(
      ids.doxology,
    );
  });

  it('gives nothing when the order only lost items', () => {
    const header: ServiceItem = {
      id: ids.pastHeader,
      kind: 'header',
      name: '더',
    };
    expect(changedPlace([...base, header], base)).toBeUndefined();
  });
});
