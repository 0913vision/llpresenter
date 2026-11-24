import {describe, expect, it} from 'vitest';
import {defaultSlideTransitions} from '@core/schema/app/preferences';
import type {Slide} from '@core/schema/slides/slide';
import {hidesNext, withHideNext} from '@core/slides/nextText';
import {joinSlide, splitSlide} from '@core/slides/textEdits';
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

describe('the choice of a slide', () => {
  const making = {themes: null, transitions: defaultSlideTransitions};
  const slide = verseSlide(1, 1, {
    texts: {본문: '하나 둘'},
    hideNext: true,
  });

  it('stays at the end of a slide that is cut', () => {
    const cut = splitSlide(making, [slide], {
      id: slide.id,
      box: '본문',
      start: 2,
      end: 2,
    });
    expect(cut?.slides.map(part => part.hideNext)).toEqual([undefined, true]);
  });

  it('is that of the last of the slides that are joined', () => {
    const before = verseSlide(2, 1, {texts: {본문: '영'}, hideNext: false});
    const joined = joinSlide([before, slide], slide.id, '본문');
    expect(joined?.slides.map(part => part.hideNext)).toEqual([true]);
  });
});
