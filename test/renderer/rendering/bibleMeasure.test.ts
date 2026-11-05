import {describe, expect, it} from 'vitest';
import {
  bibleMeasure,
  measureBibleLines,
} from '@renderer/rendering/bibleMeasure';
import {themeElementBase} from '@fixtures/core/themeOutput';

const spec = {
  font: 'Mock font',
  size: 36,
  tracking: 0,
  markerTracking: 0,
  width: 10,
  maxLines: 2,
  marker: ' (계속)',
  markerSize: 28,
};
const widthOf = (text: string, size: number) =>
  (Array.from(text).length * size) / 36;

describe('theme Bible text measurement', () => {
  it('wraps at word boundaries, ignores trailing gaps, and counts the smaller marker', () => {
    const measured = measureBibleLines('가나다 라마바 사아자', spec, widthOf);
    expect(measured.lines).toEqual(['가나다 라마바', '사아자 (계속)']);
    expect(measured.fits).toBe(true);
    expect(measured.lineWidths[1]).toBeCloseTo(3 + (5 * 28) / 36);
    expect(
      measureBibleLines('가나다 라마바 사아자', {...spec, maxLines: 1}, widthOf)
        .fits,
    ).toBe(false);
  });

  it('moves the marker onto its own line and splits only oversized words', () => {
    expect(
      measureBibleLines('가나다라마바', {...spec, width: 6}, widthOf).lines,
    ).toEqual(['가나다라마바', '(계속)']);
    expect(
      measureBibleLines(
        '가나다라마바사아',
        {...spec, width: 3, marker: ''},
        widthOf,
      ).lines,
    ).toEqual(['가나다', '라마바', '사아']);
    expect(
      measureBibleLines('😀😀😀', {...spec, width: 2, marker: ''}, widthOf)
        .lines,
    ).toEqual(['😀😀', '😀']);
  });

  it('uses the actual font weight and box-height limit instead of shrinking the type', () => {
    const element = {
      ...themeElementBase(),
      kind: 'currentText' as const,
      frame: {x: 0, y: 0, w: 500, h: 90},
      text: {
        ...themeElementBase().text,
        font: 'Sample font',
        size: 36,
        weight: 600,
        maxLines: 4,
        lineHeight: 1.25,
      },
    };
    const context = {
      font: '',
      measureText: (text: string) => ({width: text.length * 10}),
    };
    const layout = bibleMeasure(element, context);
    expect(layout.spec).toMatchObject({
      font: 'Sample font',
      size: 36,
      width: 500,
      maxLines: 2,
    });
    const measured = layout.measure('가 나', {
      ...layout.spec,
      marker: '',
      markerSize: 28,
    });
    expect(measured.fits).toBe(true);
    expect(context.font).toContain('600 36px "Sample font"');
  });
});
