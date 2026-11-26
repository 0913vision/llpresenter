import {describe, expect, it} from 'vitest';
import {CONT_MARKER} from '@core/bible';
import {measureSplitLines} from '@renderer/rendering/theme/splitMeasure';

/** Every letter is 10 px wide, at any size. */
function widthOf(text: string): number {
  return Array.from(text).length * 10;
}

function spec(width: number, more: {maxLines?: number; marker?: string} = {}) {
  return {
    font: 'Invented Sans',
    size: 60,
    tracking: 0,
    markerTracking: 0,
    width,
    maxLines: more.maxLines ?? 4,
    marker: more.marker ?? '',
    markerSize: 40,
  };
}

describe('measureSplitLines', () => {
  it('wraps between words, keeping each word whole when it fits a line', () => {
    const result = measureSplitLines('가나다 라마바 사아', spec(70), widthOf);
    expect(result.lines).toEqual(['가나다 라마바', '사아']);
    expect(result.fits).toBe(true);
  });

  it('breaks a word longer than a line between its letters', () => {
    expect(
      measureSplitLines('가나다라마바사아자차', spec(50), widthOf).lines,
    ).toEqual(['가나다라마', '바사아자차']);
  });

  it('keeps the typed line breaks', () => {
    expect(
      measureSplitLines('태초에\n하나님이', spec(200), widthOf).lines,
    ).toEqual(['태초에', '하나님이']);
  });

  it('counts the tracking between the letters of a line, which can make it wrap', () => {
    const wide = {...spec(60), tracking: 5};
    expect(measureSplitLines('가나다라', wide, widthOf).lineWidths).toEqual([
      55,
    ]);
    const narrow = {...spec(50), tracking: 5};
    expect(measureSplitLines('가나다라', narrow, widthOf).lines).toEqual([
      '가나다',
      '라',
    ]);
  });

  it('puts the continuation mark after the last line when it fits, else on a line of its own', () => {
    const marker = CONT_MARKER;
    const short = measureSplitLines('가나', spec(70, {marker}), widthOf);
    expect(short.lines).toEqual([`가나${CONT_MARKER}`]);
    const long = measureSplitLines('가나다라마', spec(70, {marker}), widthOf);
    expect(long.lines).toEqual(['가나다라마', CONT_MARKER.trimStart()]);
  });

  it('says the text does not fit when it takes more lines than the box holds', () => {
    const result = measureSplitLines(
      '가나다 라마바 사아',
      spec(70, {maxLines: 1}),
      widthOf,
    );
    expect(result.nLines).toBe(2);
    expect(result.fits).toBe(false);
  });
});
