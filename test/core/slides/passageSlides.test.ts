import {describe, expect, it} from 'vitest';
import {genesisPassage} from '@fixtures/core/passage';
import {defaultSlideTransitions} from '@core/schema/app/preferences';
import type {Slide} from '@core/schema/slides/slide';
import {passageSlides, withVerseSlideIds} from '@core/slides/passageSlides';

const making = {themes: null, transitions: defaultSlideTransitions};
const FIRST = '태초에 하나님이 천지를 창조하시니라';
const SECOND = '땅이 혼돈하고 공허하며';
const TWO = genesisPassage([
  [1, FIRST],
  [2, SECOND],
]);
const ONE = genesisPassage([[1, FIRST]]);
const settings = {verseNumbers: true, translationName: false};
const whole = (text: string) => [text];
const texts = (slides: readonly Slide[]) =>
  slides.map(slide => slide.texts['본문']);

describe('passageSlides', () => {
  it('numbers each verse and marks the slides that go on', () => {
    const slides = passageSlides(making, {
      passage: TWO,
      settings,
      cut: text => (text === FIRST ? text.split(' 천지를 ') : [text]),
    });
    expect(texts(slides)).toEqual([
      '1 태초에 하나님이',
      '창조하시니라',
      `2 ${SECOND}`,
    ]);
    expect(slides.map(slide => slide.continued)).toEqual([
      true,
      undefined,
      undefined,
    ]);
    expect(slides.map(slide => slide.verse?.verse)).toEqual([1, 1, 2]);
  });

  it('shows no number for one verse alone', () => {
    expect(
      texts(passageSlides(making, {passage: ONE, settings, cut: whole})),
    ).toEqual([FIRST]);
  });

  it('keeps the slides a verse has, and gives the first its number', () => {
    const one = passageSlides(making, {passage: ONE, settings, cut: whole});
    const grown = passageSlides(making, {
      passage: TWO,
      settings,
      cut: whole,
      before: one,
    });
    expect(grown[0]?.id).toBe(one[0]?.id);
    expect(texts(grown)).toEqual([`1 ${FIRST}`, `2 ${SECOND}`]);
  });

  it('leaves a verse that was changed by hand as it is', () => {
    const [one] = passageSlides(making, {passage: ONE, settings, cut: whole});
    if (one === undefined) throw new Error('No slide');
    const changed = {...one, texts: {...one.texts, 본문: '고친 본문'}};
    const grown = passageSlides(making, {
      passage: TWO,
      settings,
      cut: whole,
      before: [changed],
    });
    expect(grown[0]?.texts).toEqual(changed.texts);
    expect(grown[0]?.id).toBe(changed.id);
  });

  it('starts only the last slide with the next one hidden on 무대', () => {
    const slides = passageSlides(making, {passage: TWO, settings, cut: whole});
    expect(slides.map(slide => slide.hideNext === true)).toEqual([false, true]);
    const [first] = slides;
    if (first === undefined) throw new Error('No slide');
    const grown = passageSlides(making, {
      passage: TWO,
      settings,
      cut: whole,
      before: [{...first, hideNext: true}],
    });
    expect(grown.map(slide => slide.hideNext === true)).toEqual([false, true]);
  });

  it('keeps the address when the name of the translation is shown', () => {
    const slides = passageSlides(making, {
      passage: TWO,
      settings: {verseNumbers: false, translationName: true},
      cut: whole,
    });
    expect(slides.map(slide => slide.texts['주소'])).toEqual([
      '창세기 1:1-2 (개역한글)',
      '창세기 1:1-2 (개역한글)',
    ]);
  });
});

describe('withVerseSlideIds', () => {
  const cutAt = (text: string) =>
    text === FIRST ? text.split(' 천지를 ') : [text];

  it('keeps the id and transition of each verse part when the numbers change', () => {
    const before = passageSlides(making, {passage: TWO, settings, cut: cutAt});
    const fade = {kind: 'dissolve', sec: 0.4} as const;
    const marked = before.map((slide, index) =>
      index === 2 ? {...slide, transition: fade} : slide,
    );
    const after = withVerseSlideIds(
      marked,
      passageSlides(making, {
        passage: TWO,
        settings: {...settings, verseNumbers: false},
        cut: cutAt,
      }),
    );
    expect(after.map(slide => slide.id)).toEqual(marked.map(slide => slide.id));
    expect(texts(after)).toEqual(['태초에 하나님이', '창조하시니라', SECOND]);
    expect(after[2]?.transition).toEqual(fade);
  });

  it('gives a verse part that is new its own id', () => {
    const before = passageSlides(making, {passage: TWO, settings, cut: whole});
    const after = withVerseSlideIds(
      before,
      passageSlides(making, {passage: TWO, settings, cut: cutAt}),
    );
    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[1]?.id).not.toBe(before[0]?.id);
    expect(after[1]?.id).not.toBe(before[1]?.id);
    expect(after[2]?.id).toBe(before[1]?.id);
  });
});
