import {describe, expect, it} from 'vitest';
import {defaultSlideTransitions} from '@core/schema/preferences';
import type {Slide} from '@core/schema/slide';
import {joinSlide, pasteSlideText, splitSlide} from '@core/slides/textEdits';
import {lyricsSlide, slideId, slideOf, verseOf} from '@fixtures/core/slides';

const making = {themes: null, transitions: defaultSlideTransitions};
const VERSE = verseOf(1);
const lyrics = (slides: readonly Slide[] | undefined) =>
  slides?.map(slide => slide.texts['가사'] ?? '');

describe('splitSlide', () => {
  const slides = [lyricsSlide(1, '첫 줄\n둘째 줄'), lyricsSlide(2, '끝')];
  const at = (start: number, end = start) => ({
    id: slideId(1),
    box: '가사',
    start,
    end,
  });

  it('cuts a slide at the end of a row without an empty row', () => {
    const result = splitSlide(making, slides, at(3));
    expect(lyrics(result?.slides)).toEqual(['첫 줄', '둘째 줄', '끝']);
    expect(result?.caret).toEqual({id: result?.slides[1]?.id, at: 0});
    expect(result?.slides[0]?.id).toBe(slideId(1));
  });

  it('cuts a slide at the start of a row the same way', () => {
    expect(lyrics(splitSlide(making, slides, at(4))?.slides)).toEqual([
      '첫 줄',
      '둘째 줄',
      '끝',
    ]);
  });

  it('leaves the selected text out', () => {
    expect(lyrics(splitSlide(making, slides, at(2, 4))?.slides)).toEqual([
      '첫',
      '둘째 줄',
      '끝',
    ]);
  });

  it('keeps the settings of the slide but not its hot key', () => {
    const [first, second] =
      splitSlide(
        making,
        [lyricsSlide(1, '가나', {label: '1절', hotKey: 'KeyQ'})],
        at(1),
      )?.slides ?? [];
    expect(first).toMatchObject({label: '1절', hotKey: 'KeyQ'});
    expect(second).toMatchObject({label: '1절'});
    expect(second).not.toHaveProperty('hotKey');
  });

  it('marks a verse that goes on', () => {
    const verse = slideOf(
      1,
      'scripture',
      {본문: '태초에 하나님이'},
      {verse: VERSE},
    );
    const result = splitSlide(making, [verse], {...at(4), box: '본문'});
    expect(result?.slides.map(slide => slide.continued)).toEqual([
      true,
      undefined,
    ]);
  });
});

describe('joinSlide', () => {
  it('puts the text after the row of the slide before', () => {
    const result = joinSlide(
      [lyricsSlide(1, '첫 줄'), lyricsSlide(2, '둘째 줄')],
      slideId(2),
      '가사',
    );
    expect(lyrics(result?.slides)).toEqual(['첫 줄\n둘째 줄']);
    expect(result?.caret).toEqual({id: slideId(1), at: 3});
  });

  it('joins the parts of one verse in one row', () => {
    const part = (number: number, text: string, more: Partial<Slide> = {}) =>
      slideOf(number, 'scripture', {본문: text}, {verse: VERSE, ...more});
    expect(
      joinSlide(
        [part(1, '태초에', {continued: true}), part(2, '하나님이')],
        slideId(2),
        '본문',
      )?.slides,
    ).toEqual([part(1, '태초에 하나님이')]);
  });

  it('leaves slides of two themes apart', () => {
    expect(
      joinSlide(
        [slideOf(1, 'songTitle', {제목: '빛의 길'}), lyricsSlide(2, '가사')],
        slideId(2),
        '가사',
      ),
    ).toBeNull();
    expect(joinSlide([lyricsSlide(1, '가사')], slideId(1), '가사')).toBeNull();
  });
});

describe('pasteSlideText', () => {
  it('starts a new slide at each blank row', () => {
    const result = pasteSlideText(making, [lyricsSlide(1, '앞뒤')], {
      id: slideId(1),
      box: '가사',
      start: 1,
      end: 1,
      pasted: '하나\r\n\r\n둘\n \n셋',
    });
    expect(lyrics(result?.slides)).toEqual(['앞하나', '둘', '셋뒤']);
    expect(result?.caret).toEqual({id: result?.slides[2]?.id, at: 1});
  });
});
