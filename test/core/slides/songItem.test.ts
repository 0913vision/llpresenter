import {describe, expect, it} from 'vitest';
import {defaultSlideTransitions} from '@core/schema/app/preferences';
import {createSongId} from '@core/schema/common/ids';
import {SONG_SCHEMA_VERSION, type Song} from '@core/schema/songs/song';
import {
  CLOSING_TITLE_NEXT,
  SONG_TITLE_LABELS,
  songItem,
  songItemBody,
  songItemSlides,
} from '@core/slides';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

const making = {themes: null, transitions: defaultSlideTransitions};
const titleSlide = slideOf(1, 'songTitle', {
  texts: {제목: '빛의 길', 부제: 'The Way'},
  background: {kind: 'color', color: '#112233'},
});
const lyrics = [
  lyricsSlide(2, '첫 줄', {label: '1절', hotKey: 'KeyA'}),
  lyricsSlide(3, '끝 줄', {label: '후렴'}),
];

function song(withTitle = true): Song {
  return {
    format: 'llsong',
    schemaVersion: SONG_SCHEMA_VERSION,
    id: createSongId('00000000-0000-4000-8000-000000000100'),
    title: '빛의 길',
    ...(withTitle ? {titleSlide} : {}),
    slides: lyrics,
  };
}

describe('songItemSlides', () => {
  it('puts the title with 전주 first and again with 후주 last, both with the 곡 제목 transition', () => {
    const slides = songItemSlides(song(), making, {closingTitle: true});

    expect(slides).toHaveLength(4);
    expect(slides[0]).toMatchObject({
      texts: titleSlide.texts,
      background: titleSlide.background,
      label: SONG_TITLE_LABELS.opening,
      transition: defaultSlideTransitions.songTitle,
    });
    expect(slides[3]).toMatchObject({
      texts: titleSlide.texts,
      label: SONG_TITLE_LABELS.closing,
      transition: defaultSlideTransitions.songTitle,
      next: CLOSING_TITLE_NEXT,
    });
    expect(slides[0]).not.toHaveProperty('next');
  });

  it('copies the other slides as they are, with their labels and hot keys, under ids of their own', () => {
    const slides = songItemSlides(song(), making, {closingTitle: true});

    expect(slides.slice(1, 3)).toMatchObject([
      {texts: {가사: '첫 줄'}, label: '1절', hotKey: 'KeyA'},
      {texts: {가사: '끝 줄'}, label: '후렴'},
    ]);
    const ids = slides.map(slide => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(titleSlide.id);
    expect(ids).not.toContain(lyrics[0]?.id);
  });

  it('keeps a hot key of the title on the opening title only', () => {
    const keyed = {...song(), titleSlide: {...titleSlide, hotKey: 'KeyT'}};

    const slides = songItemSlides(keyed, making, {closingTitle: true});

    expect(slides[0]?.hotKey).toBe('KeyT');
    expect(slides.at(-1)).not.toHaveProperty('hotKey');
  });

  it('leaves out the closing title when the 환경설정 says so', () => {
    const slides = songItemSlides(song(), making, {closingTitle: false});

    expect(slides.map(slide => slide.label)).toEqual(['전주', '1절', '후렴']);
  });

  it('makes a title from the song title for a song without a title slide', () => {
    const slides = songItemSlides(song(false), making, {closingTitle: true});

    expect(slides[0]).toMatchObject({texts: {제목: '빛의 길'}, label: '전주'});
    expect(slides.at(-1)).toMatchObject({
      texts: {제목: '빛의 길'},
      label: '후주',
    });
  });
});

describe('songItem', () => {
  it('names the item after the song and points at it', () => {
    expect(songItem(song(), making, {closingTitle: true})).toMatchObject({
      kind: 'song',
      name: '빛의 길',
      song: '00000000-0000-4000-8000-000000000100',
    });
  });
});

describe('songItemBody', () => {
  it('takes the 전주 and 후주 titles and a title in the middle out, and keeps the lyrics', () => {
    const middle = slideOf(9, 'songTitle', {texts: {제목: '다른 곡'}});
    const slides = songItemSlides(song(), making, {closingTitle: true});
    const withMiddle = [...slides.slice(0, 2), middle, ...slides.slice(2)];

    expect(
      songItemBody(withMiddle, '빛의 길').map(slide => slide.texts),
    ).toEqual(lyrics.map(slide => slide.texts));
  });

  it('takes out the 전주 and 후주 copies of a picture title and of a title in 가사, and keeps a lyric that sings the title', () => {
    const picture = slideOf(1, 'lyrics', {
      texts: {},
      background: {kind: 'color', color: '#112233'},
    });
    const sung = lyricsSlide(4, '빛의 길');
    const slides = [
      {...picture, label: '전주'},
      ...lyrics,
      {...lyricsSlide(5, '빛의 길'), label: '후주'},
      sung,
      {...picture, id: slideOf(6, 'lyrics').id, label: '후주'},
    ];

    expect(songItemBody(slides, '빛의 길')).toEqual([...lyrics, sung]);
  });

  it('takes out the own 전주 first and 후주 last of an item also after the song was renamed', () => {
    const slides = [
      {...lyricsSlide(1, '빛의 길'), label: '전주'},
      ...lyrics,
      {...lyricsSlide(5, '빛의 길'), label: '후주', next: '(후주)'},
    ];

    expect(songItemBody(slides, '빛의 새 길')).toEqual(lyrics);
  });

  it('keeps a lyric with the 이름표 전주 or 후주 away from the ends', () => {
    const verse = {...lyricsSlide(4, '다른 가사'), label: '후주'};
    const slides = [...lyrics.slice(0, 1), verse, ...lyrics.slice(1)];

    expect(songItemBody(slides, '빛의 길')).toEqual(slides);
  });
});
