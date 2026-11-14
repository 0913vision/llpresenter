import {describe, expect, it} from 'vitest';
import {powerpointSlides} from '@core/songs/powerpointSlides';

describe('PowerPoint title slides', () => {
  const slide = (number: number, lines: string[], label?: string) => ({
    number,
    background: null,
    shapes: [{body: true, lines}],
    ...(label === undefined ? {} : {label}),
  });
  it('recognizes a body-placeholder title matching the chosen name, preserving its label', () => {
    expect(
      powerpointSlides(
        [slide(1, [' 은혜 로다 '], '전주'), slide(2, ['은혜로다 시작됐네'])],
        '은혜로다',
      ),
    ).toEqual([
      {label: '전주', titleSlide: true, lines: [' 은혜 로다 ']},
      {lines: ['은혜로다 시작됐네']},
    ]);
  });
  it('marks the first nonempty short line when the next slide does not continue it', () => {
    expect(
      powerpointSlides(
        [
          slide(1, []),
          slide(2, ['은혜로다']),
          slide(3, ['시작됐네 우리 주님의 능력이']),
        ],
        '다른 파일',
      ),
    ).toEqual([
      {lines: []},
      {titleSlide: true, lines: ['은혜로다']},
      {lines: ['시작됐네 우리 주님의 능력이']},
    ]);
  });
  it('keeps continuing or long body text as lyrics and does not promote later lyrics', () => {
    expect(
      powerpointSlides(
        [
          slide(1, ['이어지는 노래']),
          slide(2, ['이어지는 노래의 다음 가사']),
          slide(3, ['짧은 가사']),
        ],
        '다른 이름',
      ),
    ).toEqual([
      {lines: ['이어지는 노래']},
      {lines: ['이어지는 노래의 다음 가사']},
      {lines: ['짧은 가사']},
    ]);
    expect(
      powerpointSlides(
        [slide(1, ['가'.repeat(41)]), slide(2, ['다음'])],
        '다른 이름',
      )[0],
    ).toEqual({lines: ['가'.repeat(41)]});
  });
  it('does not lose multiline lyrics when matching a song name', () => {
    const lines = ['하나', '둘', '셋'];
    expect(
      powerpointSlides([slide(1, lines), slide(2, ['다음'])], '하나둘셋')[0],
    ).toEqual({lines});
  });
});

describe('PowerPoint lyric color vote', () => {
  it('chooses the most common lyric color, ignores titles and defaults to light text', async () => {
    const {powerpointDarkLyrics} = await import('@core/songs/powerpointSlides');
    const slide = (value: number | null, body = true) => ({
      number: 1,
      background: null,
      lyricColor: value,
      shapes: [{body, lines: ['line']}],
    });
    expect(
      powerpointDarkLyrics([
        slide(0),
        slide(0),
        slide(0xffffff),
        slide(0xffffff, false),
      ]),
    ).toBe(true);
    expect(
      powerpointDarkLyrics([slide(0), slide(0xffffff), slide(0xffffff)]),
    ).toBe(false);
    expect(powerpointDarkLyrics([slide(null)])).toBe(false);
  });
});
