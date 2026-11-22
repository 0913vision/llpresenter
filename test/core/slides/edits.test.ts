import {describe, expect, it} from 'vitest';
import {
  assignHotKey,
  moveSlides,
  pasteSlides,
  removeSlides,
  slidesText,
  withNext,
  withText,
} from '@core/slides/edits';
import type {Slide} from '@core/schema/slide';
import {lyricsSlide, slideId} from '@fixtures/core/slides';

const slides = [1, 2, 3, 4].map(number => lyricsSlide(number, `${number}`));
const lyrics = (list: readonly Slide[]) =>
  list.map(slide => slide.texts['가사']).join('');

describe('slide edits', () => {
  it('moves slides together to a gap of the list', () => {
    const picked = new Set([slideId(1), slideId(3)]);
    expect(lyrics(moveSlides(slides, picked, 4))).toBe('2413');
    expect(lyrics(moveSlides(slides, new Set([slideId(4)]), 0))).toBe('4123');
  });

  it('gives pasted slides ids of their own and no hot key', () => {
    const {slides: pasted, added} = pasteSlides(slides, 1, [
      lyricsSlide(1, 'x', {hotKey: 'KeyQ'}),
    ]);
    expect(added).toEqual([pasted[1]]);
    expect(lyrics(pasted)).toBe('1x234');
    expect(pasted[1]?.id).not.toBe(slideId(1));
    expect(pasted[1]).not.toHaveProperty('hotKey');
  });

  it('removes slides', () => {
    expect(lyrics(removeSlides(slides, new Set([slideId(2)])))).toBe('134');
  });

  it('keeps a hot key on one slide', () => {
    const keyed = assignHotKey(
      [lyricsSlide(1, '1', {hotKey: 'KeyQ'}), lyricsSlide(2, '2')],
      slideId(2),
      'KeyQ',
    );
    expect(keyed.map(slide => slide.hotKey)).toEqual([undefined, 'KeyQ']);
  });

  it('leaves out an empty text and an empty next text', () => {
    const slide = lyricsSlide(1, '가사', {next: '다음'});
    expect(withText(slide, '가사', '').texts).toEqual({});
    expect(withText(slide, '가사', '새 가사').texts).toEqual({가사: '새 가사'});
    expect(withNext(slide, '')).not.toHaveProperty('next');
  });

  it('reads as plain text with a blank row between slides', () => {
    expect(slidesText(slides.slice(0, 2))).toBe('1\n\n2');
  });
});
