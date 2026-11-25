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

    const parts = splitSongTitle(
      [title(1, '전주'), verse, title(3, '후주')],
      '빛의 길',
    );

    const {label: _label, ...opening} = title(1, '전주');
    expect(parts).toEqual({titleSlide: opening, slides: [verse]});
  });

  it('keeps a title at the end that is not the song’s own, and the last slide of a song without an opening title', () => {
    const verse = lyricsSlide(2, '첫 줄');
    const other = slideOf(3, 'songTitle', {texts: {제목: '다른 곡'}});

    expect(splitSongTitle([title(1), verse, other], '빛의 길').slides).toEqual([
      verse,
      other,
    ]);
    expect(splitSongTitle([verse, title(3)], '빛의 길')).toEqual({
      titleSlide: undefined,
      slides: [verse, title(3)],
    });
  });

  it('drops the 후주 copy of a picture title and of a title in 가사 when an item is saved back, and keeps a last lyric that sings the title', () => {
    const picture = slideOf(1, 'lyrics', {
      texts: {},
      background: {kind: 'color', color: '#112233'},
    });
    const verse = lyricsSlide(2, '첫 줄');
    const pictureClosing = {
      ...picture,
      id: slideOf(3, 'lyrics').id,
      label: '후주',
    };
    expect(
      splitSongTitle(
        [{...picture, label: '전주'}, verse, pictureClosing],
        '찬송',
      ).slides,
    ).toEqual([verse]);

    const sung = lyricsSlide(1, '빛의 길');
    const sungClosing = {...lyricsSlide(3, '빛의 길'), label: '후주'};
    expect(
      splitSongTitle([sung, verse, sungClosing], '빛의 길').slides,
    ).toEqual([verse]);
    const refrain = lyricsSlide(3, '빛의 길');
    expect(splitSongTitle([sung, verse, refrain], '빛의 길').slides).toEqual([
      verse,
      refrain,
    ]);
  });

  it('keeps a title in the middle where it is', () => {
    const middle = slideOf(3, 'songTitle', {texts: {제목: '다른 곡'}});
    const slides = [lyricsSlide(2, '첫 줄'), middle, lyricsSlide(4, '끝 줄')];

    expect(splitSongTitle([title(1), ...slides], '빛의 길').slides).toEqual(
      slides,
    );
  });

  it('never takes a title from after the first lyrics', () => {
    const slides = [
      lyricsSlide(1, '첫 줄'),
      slideOf(2, 'songTitle', {texts: {제목: '다른 곡'}}),
      lyricsSlide(3, '끝 줄'),
    ];

    expect(splitSongTitle(slides, '빛의 길')).toEqual({
      titleSlide: undefined,
      slides,
    });
  });

  it('takes a picture with no text that opens a hymn, and keeps a blank slide before a title', () => {
    const picture = slideOf(1, 'lyrics', {
      texts: {},
      label: '전주',
      background: {kind: 'color', color: '#112233'},
    });
    const verse = lyricsSlide(2, '첫 줄');
    const {label: _label, ...opening} = picture;
    expect(splitSongTitle([picture, verse], '새찬송가 301장')).toEqual({
      titleSlide: opening,
      slides: [verse],
    });

    const blank = slideOf(1, 'lyrics', {texts: {}});
    expect(splitSongTitle([blank, title(2), verse], '빛의 길')).toEqual({
      titleSlide: title(2),
      slides: [blank, verse],
    });
  });

  it('takes a first slide whose lyrics are only the song title', () => {
    const opening = lyricsSlide(1, ' 빛의  길 ');
    const verse = lyricsSlide(2, '첫 줄');

    expect(splitSongTitle([opening, verse], '빛의 길')).toEqual({
      titleSlide: opening,
      slides: [verse],
    });
    expect(splitSongTitle([verse, opening], '빛의 길').titleSlide).toBe(
      undefined,
    );
  });

  it('keeps a song of one title, and a song without one, as they are', () => {
    expect(splitSongTitle([title(1)], '빛의 길')).toEqual({
      titleSlide: title(1),
      slides: [],
    });
    const lyrics = [lyricsSlide(1, '첫 줄')];
    expect(splitSongTitle(lyrics, '빛의 길')).toEqual({
      titleSlide: undefined,
      slides: lyrics,
    });
  });
});
