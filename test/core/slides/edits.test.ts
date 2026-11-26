import {describe, expect, it} from 'vitest';
import {
  assignHotKey,
  changeSlides,
  moveSlides,
  pasteSlides,
  removeSlides,
  replacePassage,
  replaceVerse,
  slidesText,
  withBackground,
  withLabel,
  withNext,
  withText,
  withTheme,
  withTransition,
} from '@core/slides/edits';
import {createMediaId} from '@core/schema/common/ids';
import type {Slide} from '@core/schema/slides/slide';
import {lyricsSlide, slideId, verseOf} from '@fixtures/core/slides';

const MEDIA = '00000000-0000-4000-8000-000000000601';

const slides = [1, 2, 3, 4].map(number => lyricsSlide(number, `${number}`));
function lyrics(list: readonly Slide[]) {
  return list.map(slide => slide.texts['가사']).join('');
}

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

describe('slide fields', () => {
  const slide = lyricsSlide(1, '주 하나님');
  const background = {kind: 'media' as const, media: createMediaId(MEDIA)};
  const transition = {kind: 'wipe' as const, dir: 'left' as const, sec: 1};

  it('keeps the same slide when a label, theme, background or transition stays', () => {
    expect(withLabel(slide, '  ')).toBe(slide);
    expect(withTheme(slide, slide.theme)).toBe(slide);
    expect(withBackground(slide, undefined)).toBe(slide);
    expect(withTransition(slide, undefined)).toBe(slide);
    const shown = withBackground(slide, background);
    expect(withBackground(shown, {...background})).toBe(shown);
    const timed = withTransition(slide, transition);
    expect(withTransition(timed, {...transition})).toBe(timed);
  });

  it('sets a trimmed label, a background and a transition, and takes them away', () => {
    const labelled = withLabel(slide, ' 1절 ');
    expect(labelled.label).toBe('1절');
    expect(withLabel(labelled, '').label).toBeUndefined();
    expect(
      withBackground(withBackground(slide, background), undefined),
    ).toEqual(slide);
    expect(withTransition(slide, transition).transition).toEqual(transition);
  });

  it('changes only the chosen slides, and gives the same list when none changes', () => {
    const list = [slide, lyricsSlide(2, '찬송')];
    const changed = changeSlides(list, new Set([slide.id]), entry =>
      withLabel(entry, '후렴'),
    );
    expect(changed[0]?.label).toBe('후렴');
    expect(changed[1]).toBe(list[1]);
    expect(
      changeSlides(list, new Set([slide.id]), entry => withLabel(entry, '')),
    ).toBe(list);
  });
});

describe('passage slides', () => {
  const title = lyricsSlide(1, '창세기 1장');
  const of = (number: number, text: string) =>
    lyricsSlide(number + 10, text, {verse: verseOf(number)});

  it('puts new slides where the slides of a verse are, and nothing for a verse that is not there', () => {
    const list = [title, of(16, 'a'), of(16, 'b'), of(17, 'c')];
    const replaced = replaceVerse(list, verseOf(16), [of(16, 'new')]);
    expect(replaced.map(entry => entry.texts['가사'])).toEqual([
      '창세기 1장',
      'new',
      'c',
    ]);
    expect(replaceVerse(list, verseOf(99), [])).toBe(list);
  });

  it('puts another passage where the verses are, after the title', () => {
    const list = [title, of(16, 'a')];
    expect(
      replacePassage(list, [of(1, 'x')]).map(entry => entry.texts['가사']),
    ).toEqual(['창세기 1장', 'x']);
    expect(
      replacePassage([title], [of(1, 'x')]).map(entry => entry.texts['가사']),
    ).toEqual(['창세기 1장', 'x']);
  });
});
