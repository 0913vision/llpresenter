import {describe, expect, it} from 'vitest';
import {slideTiles} from '@core/slides/tiles';
import type {Slide} from '@core/schema/slides/slide';
import {AUTO_TOKENS} from '@core/schema/slides/slideContent';
import {lyricsSlide, slideOf, verseOf} from '@fixtures/core/slides';

describe('slideTiles', () => {
  it('names the label once where it starts', () => {
    const tiles = slideTiles(
      [
        lyricsSlide(1, '가', {label: '1절'}),
        lyricsSlide(2, '나', {label: '1절'}),
        lyricsSlide(3, '다', {label: '후렴'}),
      ],
      {kind: 'song', title: '빛의 길'},
      new Map([['1절', '#112233']]),
    );
    expect(tiles.map(tile => tile.auto[AUTO_TOKENS.newLabel])).toEqual([
      '1절',
      undefined,
      '후렴',
    ]);
    expect(tiles.map(tile => tile.caption)).toEqual(['1절', '1절', '후렴']);
    expect(tiles.map(tile => tile.labelColor)).toEqual([
      '#112233',
      '#112233',
      'none',
    ]);
  });

  it('counts the slides of each theme', () => {
    const tiles = slideTiles(
      [
        slideOf(1, 'title', {texts: {제목: '광고'}}),
        slideOf(2, 'notice', {texts: {제목: '하나'}}),
        slideOf(3, 'notice', {texts: {제목: '둘'}}),
      ],
      {kind: 'notice', title: '광고'},
    );
    expect(tiles.map(tile => tile.auto[AUTO_TOKENS.number])).toEqual([
      '1',
      '1',
      '2',
    ]);
    expect(tiles.map(tile => tile.caption)).toEqual(['광고', '하나', '둘']);
  });

  it('names the parts of a verse', () => {
    const tiles = slideTiles(
      [
        slideOf(1, 'scripture', {texts: {본문: '가'}, verse: verseOf(1)}),
        slideOf(2, 'scripture', {texts: {본문: '나'}, verse: verseOf(1)}),
        slideOf(3, 'scripture', {texts: {본문: '다'}, verse: verseOf(2)}),
      ],
      {kind: 'bible', title: '창세기 1:1-2', passage: '창세기 1:1-2'},
    );
    expect(tiles.map(tile => tile.caption)).toEqual([
      '창1:1 (1)',
      '창1:1 (2)',
      '창1:2',
    ]);
  });
});

describe('a hymn', () => {
  const sad = {hymnal: 'new', number: 91} as const;
  const valuesOf = (title: string, slide: Partial<Slide> = {}) =>
    slideTiles([slideOf(1, 'songTitle', slide)], {kind: 'song', title})[0]
      ?.auto;

  it('names the song without its number and gives the number apart', () => {
    const named = (title: string, slide?: Partial<Slide>) => {
      const values = valuesOf(title, slide);
      return [values?.[AUTO_TOKENS.song], values?.[AUTO_TOKENS.hymnNumber]];
    };
    expect(named('91장 슬픈 마음')).toEqual(['슬픈 마음', '새찬송가 91장']);
    expect(named('슬픈 마음', {hymn: sad})).toEqual([
      '슬픈 마음',
      '새찬송가 91장',
    ]);
    expect(named('새찬송가 91장')).toEqual([
      '슬픈 마음 있는 사람',
      '새찬송가 91장',
    ]);
    expect(named('빛의 길')).toEqual(['빛의 길', undefined]);
  });

  it('gives every slide of a hymn its number and its title', () => {
    const tiles = slideTiles(
      [slideOf(1, 'songTitle', {hymn: sad}), slideOf(2, 'lyrics')],
      {kind: 'song', title: '슬픈 마음'},
    );
    expect(tiles[1]?.auto).toMatchObject({
      [AUTO_TOKENS.hymnNumber]: '새찬송가 91장',
      [AUTO_TOKENS.hymnTitle]: '슬픈 마음 있는 사람',
    });
  });

  it('gives its slide its number and its title in the hymnal', () => {
    expect(valuesOf('곡', {hymn: sad})).toMatchObject({
      [AUTO_TOKENS.hymnNumber]: '새찬송가 91장',
      [AUTO_TOKENS.hymnTitle]: '슬픈 마음 있는 사람',
    });
    expect(valuesOf('곡')).not.toHaveProperty(AUTO_TOKENS.hymnTitle);
  });
});
