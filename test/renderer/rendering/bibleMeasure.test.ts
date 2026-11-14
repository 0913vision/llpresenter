import {describe, expect, it} from 'vitest';
import {
  bibleMeasure,
  bibleScreenMeasure,
  measureBibleLines,
} from '@renderer/rendering/bibleMeasure';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {layoutText} from '@core/bible/split/layout';
import {splitVerse} from '@core/bible/split/splitter';
import {planSlides} from '@core/bible/split/manualSplit';

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

/**
 * Canvas advances from Noto Serif KR Medium: body at 36px, marker at 28px.
 * The output's body text node + smaller span has one tracking interval at
 * the join. DOM width minus terminal tracking agrees within 1/64px.
 */
const notoWidths: Readonly<Record<string, number>> = {
  하나님이: 139.10400390625,
  ' ': 8.67999267578125,
  '(계속)': 74.815948486328,
};
const notoWidth = (value: string): number => {
  const width = notoWidths[value];
  if (width === undefined) throw new Error(`Unmeasured font run: ${value}`);
  return width;
};

describe('theme Bible text measurement', () => {
  it.each([
    {tracking: -1.5, width: 211, fits: true, lastWidth: 210.599945068359},
    {tracking: 0, width: 223, fits: true, lastWidth: 222.599945068359},
    {tracking: 2, width: 237, fits: false, lastWidth: 80.815948486328},
  ])(
    'counts the real-font continuation join at tracking $tracking',
    ({tracking, width, fits, lastWidth}) => {
      const measured = measureBibleLines(
        '하나님이',
        {
          ...spec,
          tracking,
          markerTracking: tracking,
          width,
          maxLines: 1,
        },
        notoWidth,
      );
      expect(measured.fits).toBe(fits);
      expect(measured.lines).toEqual(
        fits ? ['하나님이 (계속)'] : ['하나님이', '(계속)'],
      );
      expect(measured.lineWidths.at(-1)).toBeCloseTo(lastWidth);
    },
  );

  it('uses short-text tracking at the real-font body/marker join', () => {
    const element = {
      ...themeElementBase(),
      kind: 'currentText' as const,
      frame: {x: 0, y: 0, w: 211, h: 100},
      text: {
        ...themeElementBase().text,
        font: 'Noto Serif KR',
        weight: 500,
        size: 36,
        maxLines: 1,
        tracking: 2,
        shortTracking: {maxCharacters: 4, tracking: -1.5},
      },
    };
    const layout = bibleMeasure(element, {
      font: '',
      measureText: value => ({width: notoWidth(value)}),
    });
    const measured = layout.measure('하나님이', {
      ...layout.spec,
      marker: ' (계속)',
      markerSize: 28,
    });
    expect(measured.lines).toEqual(['하나님이 (계속)']);
    expect(measured.fits).toBe(true);
    expect(measured.lineWidths[0]).toBeCloseTo(210.59994506835938);
  });

  it.each([undefined, 'disc'] as const)(
    'reserves %s hanging indent without charging paragraph gaps to measured wrap rows',
    bulletStyle => {
      const element = {
        ...themeElementBase(),
        kind: 'currentText' as const,
        frame: {x: 0, y: 0, w: 500, h: 315},
        text: {
          ...themeElementBase().text,
          size: 86,
          lineHeight: 105 / 86,
          maxLines: 5,
          bullets: true,
          ...(bulletStyle === undefined ? {} : {bulletStyle}),
        },
      };
      expect(
        bibleMeasure(element, {font: '', measureText: () => ({width: 10})})
          .spec,
      ).toMatchObject({width: bulletStyle === 'disc' ? 393 : 410, maxLines: 3});
    },
  );
  it('uses the theme tracking for both verse wrapping and its continuation marker', () => {
    const element = {
      ...themeElementBase(),
      kind: 'currentText' as const,
      frame: {x: 0, y: 0, w: 42, h: 300},
      text: {...themeElementBase().text, size: 36, maxLines: 5, tracking: -3},
    };
    const layout = bibleMeasure(element, {
      font: '',
      measureText: value => ({width: Array.from(value).length * 10}),
    });
    expect(layout.spec).toMatchObject({tracking: -3, markerTracking: -3});
    const options = {...layout.spec, marker: '', markerSize: 28};
    expect(layout.measure('가나다라마', options).lines).toEqual(['가나다라마']);
    expect(
      layout.measure('가나다라마', {...options, tracking: 0}).lines,
    ).toEqual(['가나다라', '마']);
    expect(
      layout
        .measure('가나다라마', {...options, marker: ' (계속)', markerSize: 28})
        .lineWidths.at(-1),
    ).toBe(31);
  });
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

it('splits when four audience lines need five stage lines and rechecks saved cuts', () => {
  const base = themeElementBase();
  const audience = {
    ...base,
    kind: 'currentText' as const,
    frame: {x: 0, y: 0, w: 20, h: 40},
    text: {...base.text, size: 10, lineHeight: 1, tracking: 0, maxLines: 4},
  };
  const stage = {
    ...audience,
    frame: {...audience.frame, w: 14},
    text: {...audience.text, maxLines: 1},
  };
  const canvas = {
    font: '',
    measureText: (text: string) => ({width: text.length}),
  };
  const text = 'aaaaa bbbbb ccccc ddddd eeeee fffff ggggg hhhhh iiiii jjjjj';
  const audienceLayout = bibleMeasure(audience, canvas);
  const stageLayout = bibleMeasure(stage, canvas, true);
  const both = bibleScreenMeasure(audience, [stage], canvas);
  expect(layoutText(text, audienceLayout).nLines).toBe(4);
  expect(layoutText(text, stageLayout).nLines).toBe(5);
  expect(planSlides(text, [], both).ok).toBe(false);
  const result = splitVerse(text, both);
  expect(result.nSlides).toBeGreaterThan(1);
  for (const chunk of result.chunks) {
    expect(layoutText(chunk.text, audienceLayout, chunk.continued).fits).toBe(
      true,
    );
    expect(layoutText(chunk.text, stageLayout, chunk.continued).fits).toBe(
      true,
    );
  }
});
