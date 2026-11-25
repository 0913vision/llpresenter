import {describe, expect, it} from 'vitest';
import {SLIDE_LIMITS} from '@core/schema/slides/slide';
import {parseSong, serializeSong} from '@core/schema/songs/song';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

function song(slides: readonly object[] = [lyricsSlide(1, 'Invented')]) {
  return {
    format: 'llsong',
    schemaVersion: 2,
    id: '00000000-0000-4000-8000-000000000100',
    title: 'Invented song',
    slides,
  };
}
function parse(data: unknown) {
  return parseSong(JSON.stringify(data), 'song.llsong');
}

function roundTrip(data: unknown): unknown {
  const {data: read} = expectSuccess(parse(data));
  return JSON.parse(expectSuccess(serializeSong(read, 'song.llsong')));
}

describe('a song file', () => {
  it('keeps its title slide, its slides and the fields it does not know', () => {
    const input = {
      ...song([
        lyricsSlide(2, '', {
          label: '오늘',
          hotKey: 'KeyA',
          background: {kind: 'color', color: '#112233'},
          transition: {kind: 'wipe', sec: 1.5},
          next: '다음',
        }),
      ]),
      titleSlide: {
        ...slideOf(1, 'songTitle', {texts: {제목: '빛의 길', 부제: ''}}),
        future: 1,
      },
      future: {kept: true},
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('reads a version 1 file with its title slide apart, without its label, and without a closing title', () => {
    const opening = slideOf(1, 'songTitle', {
      texts: {제목: '빛의 길'},
      label: '전주',
    });
    const medley = slideOf(3, 'songTitle', {texts: {제목: '다른 곡'}});
    const closing = slideOf(5, 'songTitle', {
      texts: {제목: '빛의 길'},
      label: '후주',
    });
    const lyrics = [lyricsSlide(2, '첫 줄'), medley, lyricsSlide(4, '끝 줄')];

    const {data} = expectSuccess(
      parse({...song([opening, ...lyrics, closing]), schemaVersion: 1}),
    );

    const {label: _label, ...titleSlide} = opening;
    expect(data.schemaVersion).toBe(2);
    expect(data.titleSlide).toEqual(titleSlide);
    expect(data.slides).toEqual(lyrics);
  });

  it('reads a version 1 file without a title slide as it is', () => {
    const {data} = expectSuccess(
      parse({...song([lyricsSlide(1, '첫 줄')]), schemaVersion: 1}),
    );

    expect(data).not.toHaveProperty('titleSlide');
    expect(data.slides).toEqual([lyricsSlide(1, '첫 줄')]);
  });

  it('refuses a title slide with the id or the hot key of another slide', () => {
    const title = slideOf(1, 'songTitle', {texts: {제목: '빛의 길'}});
    expect(
      parse({...song([lyricsSlide(1, '첫 줄')]), titleSlide: title}).ok,
    ).toBe(false);
    expect(
      parse({
        ...song([lyricsSlide(2, '첫 줄', {hotKey: 'KeyA'})]),
        titleSlide: {...title, hotKey: 'KeyA'},
      }).ok,
    ).toBe(false);
    expect(
      parse({...song([lyricsSlide(2, '첫 줄')]), titleSlide: title}).ok,
    ).toBe(true);
  });

  it('refuses a song with neither a title slide nor another slide', () => {
    expect(parse(song([])).ok).toBe(false);
  });

  it('trims labels and refuses the empty and the long ones', () => {
    const labeled = (label: unknown) => song([{...lyricsSlide(1, ''), label}]);
    expect(roundTrip(labeled(' 후렴 '))).toEqual(labeled('후렴'));
    for (const label of ['', '  ', 'x'.repeat(SLIDE_LIMITS.label + 1), 1]) {
      expect(parse(labeled(label)).ok).toBe(false);
    }
  });

  it('refuses slides with one id or one hot key', () => {
    expect(parse(song([lyricsSlide(1, 'a'), lyricsSlide(1, 'b')])).ok).toBe(
      false,
    );
    const keyed = (number: number, hotKey: string) =>
      lyricsSlide(number, 'a', {hotKey});
    expect(parse(song([keyed(1, 'KeyA'), keyed(2, 'KeyA')])).ok).toBe(false);
    expect(parse(song([keyed(1, 'KeyA'), keyed(2, 'KeyB')])).ok).toBe(true);
  });

  it('refuses a slide without a theme or with a text that is none', () => {
    const {theme: _theme, ...slide} = lyricsSlide(1, 'a');
    expect(parse(song([slide])).ok).toBe(false);
    expect(parse(song([{...slide, theme: 'lyrics'}])).ok).toBe(false);
    expect(parse(song([{...lyricsSlide(1, ''), texts: {가사: 1}}])).ok).toBe(
      false,
    );
  });

  it('has at least one slide and at most the cap', () => {
    expect(parse(song([])).ok).toBe(false);
    const many = (count: number) =>
      song(Array.from({length: count}, (_, index) => lyricsSlide(index, '')));
    expect(parse(many(SLIDE_LIMITS.slides)).ok).toBe(true);
    expect(parse(many(SLIDE_LIMITS.slides + 1)).ok).toBe(false);
  });
});
