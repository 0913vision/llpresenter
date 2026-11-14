import {describe, expect, it} from 'vitest';
import {powerpointSlides} from '@core/songs/powerpointSlides';

it('records how many title lines belong to the first PowerPoint box', () => {
  const hymn = powerpointSlides([
    {
      number: 1,
      background: null,
      shapes: [
        {body: false, lines: ['새찬송가 91장', '슬픈 마음 있는 사람']},
        {body: false, lines: ['English']},
      ],
    },
  ]);
  expect(hymn[0]).toMatchObject({
    titleLineCount: 2,
    lines: ['새찬송가 91장', '슬픈 마음 있는 사람', 'English'],
  });
  const song = powerpointSlides([
    {
      number: 1,
      background: null,
      shapes: [
        {body: false, lines: ['날마다 숨쉬는 순간마다']},
        {body: false, lines: ['Day by Day']},
      ],
    },
  ]);
  expect(song[0]).not.toHaveProperty('titleLineCount');
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
