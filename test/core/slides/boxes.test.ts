import {expect, it} from 'vitest';
import {withTypedText} from '@core/slides';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {SONG_THEME_IDS} from '@core/theme/builtIn/ids';
import {lyricsSlide} from '@fixtures/core/slides';

const hymnTheme = BUILT_IN_THEMES.find(
  theme => theme.id === SONG_THEME_IDS.dark.hymnTitle,
);

it('takes a hymn typed into the number box as the hymn of the slide', () => {
  if (hymnTheme === undefined) throw new Error('no hymn title theme');
  const slide = lyricsSlide(1, '');
  const typed = withTypedText(hymnTheme, slide, {
    box: '찬송가',
    text: '새찬송가 7장',
  });
  expect(typed.hymn).toEqual({hymnal: 'new', number: 7});
  expect(typed.texts['찬송가']).toBe('새찬송가 7장');
  expect(
    withTypedText(hymnTheme, slide, {
      box: '찬송가',
      text: '통일 6장 찬양 성부 성자 성령',
    }).hymn,
  ).toEqual({hymnal: 'unified', number: 6});
});

it('keeps other texts and other boxes as typed', () => {
  if (hymnTheme === undefined) throw new Error('no hymn title theme');
  const slide = lyricsSlide(1, '');
  expect(
    withTypedText(hymnTheme, slide, {box: '찬송가', text: '새찬송가 7'}).hymn,
  ).toBe(slide.hymn);
  expect(
    withTypedText(hymnTheme, slide, {
      box: '찬송가',
      text: '새찬송가 7장 다른 노래',
    }).hymn,
  ).toBe(slide.hymn);
  expect(
    withTypedText(hymnTheme, slide, {box: '제목', text: '새찬송가 7장'}).hymn,
  ).toBe(slide.hymn);
});
