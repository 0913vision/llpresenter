import {describe, expect, it} from 'vitest';

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
