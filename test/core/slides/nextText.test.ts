import {describe, expect, it} from 'vitest';
import {defaultSlideTransitions} from '@core/schema/preferences';
import type {Slide} from '@core/schema/slide';
import {hidesNext, withHideNext} from '@core/slides/nextText';
import {joinSlide, splitSlide} from '@core/slides/textEdits';
import {slideOf, verseOf} from '@fixtures/core/slides';

const ENDS = {hideNextAtEnd: true};

function verseSlide(id: number, verse: number, more: Partial<Slide> = {}) {
  return slideOf(id, 'scripture', {verse: verseOf(verse), ...more});
}

function hiding(slides: readonly Slide[], theme = ENDS): readonly boolean[] {
  const tiles = slides.map(slide => ({slide}));
  return slides.map((_, index) => hidesNext(tiles, index, theme));
}

describe('hidesNext', () => {
  it('is on at the end of a list, when the theme wants it', () => {
    const slides = [verseSlide(1, 1), verseSlide(2, 2)];
    expect(hiding(slides)).toEqual([false, true]);
    expect(hiding(slides, {hideNextAtEnd: false})).toEqual([false, false]);
  });

  it('is on at the end of each passage of a list', () => {
    const slides = [
      verseSlide(1, 1),
      verseSlide(2, 1),
      verseSlide(3, 2),
      verseSlide(4, 10),
      slideOf(5, 'blank'),
    ];
    expect(hiding(slides)).toEqual([false, false, true, true, true]);
  });

  it('goes on into the next chapter', () => {
    const slides = [
      verseSlide(1, 31),
      verseSlide(2, 1, {verse: {...verseOf(1), chapter: 2}}),
    ];
    expect(hiding(slides)).toEqual([false, true]);
  });

  it('is what the slide says, whatever the theme wants', () => {
    const slides = [
      verseSlide(1, 1, {hideNext: true}),
      verseSlide(2, 2, {hideNext: false}),
    ];
    expect(hiding(slides)).toEqual([true, false]);
  });
});

it('keeps only a choice that differs from the rule', () => {
  const slide = verseSlide(1, 1);
  expect(withHideNext(slide, true, false)).toEqual({...slide, hideNext: true});
  expect(withHideNext({...slide, hideNext: true}, false, false)).toEqual(slide);
  expect(withHideNext(slide, false, true)).toEqual({...slide, hideNext: false});
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
