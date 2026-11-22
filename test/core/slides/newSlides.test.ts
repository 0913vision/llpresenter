import {describe, expect, it} from 'vitest';
import {defaultSlideTransitions} from '@core/schema/preferences';
import {slideAfter, slidesOfText} from '@core/slides/newSlides';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

const making = {themes: null, transitions: defaultSlideTransitions};

describe('slideAfter', () => {
  it('makes what the item is made of when nothing is before', () => {
    expect(slideAfter(making, undefined, 'song').theme).toBe(
      BUILT_IN_THEME_IDS.lyrics,
    );
    expect(slideAfter(making, undefined, 'notice').theme).toBe(
      BUILT_IN_THEME_IDS.notice,
    );
  });

  it('follows a song title with lyrics on the same background', () => {
    const background = {kind: 'color', color: '#112233'} as const;
    const title = slideOf(1, 'songTitle', {texts: {제목: '빛의 길'}, background});
    expect(slideAfter(making, title, 'song')).toMatchObject({
      theme: BUILT_IN_THEME_IDS.lyrics,
      background,
    });
  });

  it('does not follow a title of the service', () => {
    const title = slideOf(1, 'title', {texts: {제목: '찬양'}});
    expect(slideAfter(making, title, 'song').theme).toBe(
      BUILT_IN_THEME_IDS.lyrics,
    );
  });
});

describe('slidesOfText', () => {
  it('makes a slide for each part between blank rows', () => {
    const slides = slidesOfText(making, '하나\n둘\n\n\n셋\r\n', {
      before: lyricsSlide(1, '앞'),
      kind: 'song',
    });
    expect(slides.map(slide => slide.texts)).toEqual([
      {가사: '하나\n둘'},
      {가사: '셋'},
    ]);
  });
});
