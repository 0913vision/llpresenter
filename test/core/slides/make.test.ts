import {describe, expect, it} from 'vitest';
import {defaultSlideTransitions} from '@core/schema/app/preferences';
import {copySlide, makeSlide, transitionFor} from '@core/slides/make';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {lyricsSlide} from '@fixtures/core/slides';

const making = {themes: null, transitions: defaultSlideTransitions};

describe('transitionFor', () => {
  it('takes the default transition that belongs to the purpose', () => {
    expect(transitionFor(making, 'lyrics')).toEqual(
      defaultSlideTransitions.song,
    );
    expect(transitionFor(making, 'scripture')).toEqual(
      defaultSlideTransitions.bible,
    );
    expect(transitionFor(making, 'notice')).toEqual(defaultSlideTransitions.ad);
    expect(transitionFor(making, 'picture')).toEqual(
      defaultSlideTransitions.blank,
    );
  });
});

describe('makeSlide', () => {
  it('makes a new slide in the theme and transition of its purpose', () => {
    const slide = makeSlide(making, 'lyrics', {texts: {가사: '주 은혜'}});

    expect(slide).toMatchObject({
      theme: BUILT_IN_THEME_IDS.lyrics,
      texts: {가사: '주 은혜'},
      transition: defaultSlideTransitions.song,
    });
    expect(makeSlide(making, 'lyrics').id).not.toBe(slide.id);
  });
});

describe('copySlide', () => {
  it('copies a slide with an id of its own and without its hot key', () => {
    const original = lyricsSlide(1, '주 은혜', {hotKey: 'A'});

    const copy = copySlide(original);

    expect(copy.id).not.toBe(original.id);
    expect(copy).not.toHaveProperty('hotKey');
    expect(copy.texts).toEqual(original.texts);
  });
});
