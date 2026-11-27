import {describe, expect, it} from 'vitest';
import {CONT_MARKER} from '@core/bible';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  elementOfBox,
  measureSplitLines,
  splitLayoutOf,
} from '@renderer/rendering/theme/splitMeasure';
import {builtIn} from '@fixtures/core/themeOutput';

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

describe('the 본문 box of a theme', () => {
  const scripture = builtIn(BUILT_IN_THEME_IDS.scripture);

  /** A canvas whose letters are half the font size wide, counting each measure. */
  function canvas() {
    const measured: string[] = [];
    const fonts: string[] = [];
    let current = '';
    return {
      measured,
      fonts,
      get font() {
        return current;
      },
      set font(value: string) {
        current = value;
        fonts.push(value);
      },
      measureText(text: string) {
        measured.push(text);
        const size = Number(/ (\d+(?:\.\d+)?)px /.exec(current)?.[1] ?? 0);
        return {width: (Array.from(text).length * size) / 2};
      },
    };
  }

  it('finds the 청중 text that shows the box, and nothing for a box no text shows', () => {
    const element = elementOfBox(scripture, '본문');
    expect(element?.kind).toBe('text');
    expect(element?.content).toContain('{본문}');
    expect(elementOfBox(scripture, '없는 상자')).toBeUndefined();
  });

  it('holds as many lines as fit the box at its own size and line height, as wide as the box', () => {
    const element = elementOfBox(scripture, '본문');
    if (element === undefined) throw new Error('no 본문 text');
    const {spec} = splitLayoutOf(element, canvas());
    const {frame, style} = element;
    expect(spec).toEqual({
      font: style.font,
      size: style.size,
      tracking: style.tracking,
      markerTracking: style.tracking,
      width: frame.w,
      maxLines: Math.floor((frame.h + 1) / (style.size * style.lineHeight)),
    });
    expect(spec.maxLines).toBeGreaterThan(1);
  });

  it('measures each text once per font and size, in the weight of the box', () => {
    const element = elementOfBox(scripture, '본문');
    if (element === undefined) throw new Error('no 본문 text');
    const context = canvas();
    const layout = splitLayoutOf(element, context);
    const options = {...layout.spec, marker: '', markerSize: layout.spec.size};
    const text = '태초에 하나님이 천지를 창조하시니라 측정 한 번';
    const first = layout.measure(text, options);
    const count = context.measured.length;
    expect(count).toBeGreaterThan(0);
    expect(layout.measure(text, options)).toEqual(first);
    expect(context.measured.length).toBe(count);
    expect(
      context.fonts.every(font => font.startsWith(`${element.style.weight} `)),
    ).toBe(true);
  });
});
