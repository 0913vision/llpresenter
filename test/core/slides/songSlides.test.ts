import {describe, expect, it} from 'vitest';
import {SONG_THEME_IDS} from '@core/theme';
import {importedSongTitle, songSlides} from '@core/slides/songSlides';
import {defaultSlideTransitions} from '@core/schema/preferences';

const making = {themes: null, transitions: defaultSlideTransitions};

function titleOf(lines: string[], more: {titleLineCount?: number} = {}) {
  return songSlides(making, {
    slides: [{titleSlide: true, lines, ...more}],
  })[0];
}

describe('the title slide of a hymn', () => {
  it('keeps the number and leaves the title to the hymnal', () => {
    const slide = titleOf(['슬픈 마음 있는 사람', '새찬송가 91장']);
    expect(slide?.theme).toBe(SONG_THEME_IDS.dark.hymnTitle);
    expect(slide?.texts).toEqual({찬송가: '새찬송가 91장'});
  });

  it('keeps a title with other words', () => {
    const slide = titleOf(['예수로 나의 구주 삼고', '새찬송가 288장']);
    expect(slide?.texts).toEqual({
      찬송가: '새찬송가 288장',
      제목: '예수로 나의 구주 삼고',
    });
  });

  it('may say its number alone or before its title', () => {
    expect(titleOf(['통일찬송가 6장'])?.texts).toEqual({
      찬송가: '통일찬송가 6장',
    });
    expect(titleOf(['91장 슬픈 노래'])?.texts).toEqual({
      찬송가: '새찬송가 91장',
      제목: '슬픈 노래',
    });
  });

  it('is an ordinary title with more than a title beside the number', () => {
    const slide = titleOf(['슬픈 마음', '새찬송가 91장', 'A Sad Heart']);
    expect(slide?.theme).toBe(SONG_THEME_IDS.dark.title);
    expect(slide?.texts).toEqual({
      제목: '슬픈 마음',
      부제: '새찬송가 91장\nA Sad Heart',
    });
  });
});

it('gives other songs their title and their subtitle', () => {
  const slide = titleOf(['빛의 길', 'The Way of Light']);
  expect(slide?.theme).toBe(SONG_THEME_IDS.dark.title);
  expect(slide?.texts).toEqual({제목: '빛의 길', 부제: 'The Way of Light'});
});

it('names a song after its title slide', () => {
  const name = (lines: string[], titleLineCount?: number) =>
    importedSongTitle({
      titleSlide: true,
      lines,
      ...(titleLineCount === undefined ? {} : {titleLineCount}),
    });
  expect(name(['빛의 길', 'The Way of Light'])).toBe('빛의 길');
  expect(name(['빛의', '길'], 2)).toBe('빛의 길');
  expect(name(['슬픈 마음', '새찬송가 91장'])).toBe('새찬송가 91장 슬픈 마음');
  expect(name(['통일찬송가 6장'])).toBe('통일찬송가 6장 찬양 성부 성자 성령');
});
