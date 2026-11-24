import {describe, expect, it} from 'vitest';
import {isTitleSlide, splitSongTitle} from '@core/schema/songs/songTitle';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

describe('isTitleSlide', () => {
  it('counts a 제목 without lyrics and a hymn title, not lyrics', () => {
    expect(isTitleSlide({texts: {제목: '빛의 길'}})).toBe(true);
    expect(isTitleSlide({texts: {}, hymn: {hymnal: 'new', number: 1}})).toBe(
      true,
    );
    expect(isTitleSlide({texts: {가사: '첫 줄'}})).toBe(false);
    expect(isTitleSlide({texts: {제목: '빛의 길', 가사: '첫 줄'}})).toBe(false);
    expect(isTitleSlide({texts: {제목: '  '}})).toBe(false);
  });
});

describe('splitSongTitle', () => {
  const title = (number: number, label?: string) =>
    slideOf(number, 'songTitle', {
      texts: {제목: '빛의 길'},
      ...(label === undefined ? {} : {label}),
    });

  it('takes the first title out without its label and drops a title at the very end', () => {
    const verse = lyricsSlide(2, '첫 줄');

    const parts = splitSongTitle([title(1, '전주'), verse, title(3, '후주')]);

    const {label: _label, ...opening} = title(1, '전주');
    expect(parts).toEqual({titleSlide: opening, slides: [verse]});
  });

  it('keeps a title in the middle where it is', () => {
    const middle = slideOf(3, 'songTitle', {texts: {제목: '다른 곡'}});
    const slides = [lyricsSlide(2, '첫 줄'), middle, lyricsSlide(4, '끝 줄')];

    expect(splitSongTitle([title(1), ...slides]).slides).toEqual(slides);
  });

  it('keeps a song of one title, and a song without one, as they are', () => {
    expect(splitSongTitle([title(1)])).toEqual({
      titleSlide: title(1),
      slides: [],
    });
    const lyrics = [lyricsSlide(1, '첫 줄')];
    expect(splitSongTitle(lyrics)).toEqual({
      titleSlide: undefined,
      slides: lyrics,
    });
  });
});
