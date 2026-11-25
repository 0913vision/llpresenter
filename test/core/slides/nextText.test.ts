import {expect, it} from 'vitest';
import type {Slide} from '@core/schema/slides/slide';
import {hidesNext, withHideNext} from '@core/slides/nextText';
import {slideOf, verseOf} from '@fixtures/core/slides';

function verseSlide(id: number, verse: number, more: Partial<Slide> = {}) {
  return slideOf(id, 'scripture', {verse: verseOf(verse), ...more});
}

it('shows the next slide unless the slide says otherwise', () => {
  expect(hidesNext(verseSlide(1, 1))).toBe(false);
  expect(hidesNext(verseSlide(2, 2, {hideNext: true}))).toBe(true);
  expect(hidesNext(undefined)).toBe(false);
});

it('keeps only the choice to hide the next slide', () => {
  const slide = verseSlide(1, 1);
  expect(withHideNext(slide, true)).toEqual({...slide, hideNext: true});
  expect(withHideNext({...slide, hideNext: true}, false)).toEqual(slide);
});
