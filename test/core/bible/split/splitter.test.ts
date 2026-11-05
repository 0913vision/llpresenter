import {describe, expect, it, vi} from 'vitest';
import {boundaryPenalty} from '@core/bible/split/boundary';
import {layoutText, fillRatio} from '@core/bible/split/layout';
import {cutsFromChunks, planSlides} from '@core/bible/split/manualSplit';
import {
  FILL_WEIGHT,
  splitVerse,
  SPLIT_LIMITS,
} from '@core/bible/split/splitter';
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';

describe('copible global DP splitter', () => {
  it('keeps a fitting verse whole and normalizes whitespace', () => {
    const layout = mockSplitLayout();
    const short = splitVerse(' 작은 \n 새가 노래한다 ', layout);
    expect(short.nSlides).toBe(1);
    expect(short.chunks[0]).toMatchObject({
      text: '작은 새가 노래한다',
      display: '작은 새가 노래한다',
      continued: false,
      chosenBy: 'fit',
    });
    expect(splitVerse(' \n ', layout).chunks).toEqual([]);
  });

  it.each([0, 1])(
    'preserves all normalized text and fits each part including its marker (extra %s)',
    extraSlides => {
      const layout = mockSplitLayout();
      const result = splitVerse(MOCK_LONG_VERSE, layout, {extraSlides});
      expect(result.nSlides).toBeGreaterThan(1);
      expect(result.nSlides).toBeLessThanOrEqual(
        result.minSlides + extraSlides,
      );
      if (extraSlides === 0) expect(result.nSlides).toBe(result.minSlides);
      expect(result.chunks.map(chunk => chunk.text).join(' ')).toBe(
        MOCK_LONG_VERSE,
      );
      result.chunks.forEach((chunk, index) => {
        const continued = index < result.chunks.length - 1;
        expect(chunk.continued).toBe(continued);
        expect(chunk.display.endsWith(' (계속)')).toBe(continued);
        expect(layoutText(chunk.text, layout, continued).fits).toBe(true);
      });
      const plan = planSlides(
        MOCK_LONG_VERSE,
        cutsFromChunks(result.chunks),
        layout,
      );
      expect(plan.ok).toBe(true);
      expect(plan.slides.map(slide => slide.text)).toEqual(
        result.chunks.map(chunk => chunk.text),
      );
    },
  );

  it('matches an exhaustive global optimum rather than a greedy boundary choice', () => {
    const text = '작은 새가 노래했다. 바람이 불어오며 푸른 나무가 자랐다.';
    const words = text.split(' ');
    const layout = mockSplitLayout(16, 2);
    const possibilities: Array<{cost: number; count: number}> = [];
    const visit = (at: number, count: number, cost: number) => {
      if (at === words.length) {
        possibilities.push({count, cost});
        return;
      }
      for (let end = at + 1; end <= words.length; end++) {
        const final = end === words.length;
        const measured = layoutText(
          words.slice(at, end).join(' '),
          layout,
          !final,
        );
        if (!measured.fits) continue;
        const boundary = final
          ? 0
          : boundaryPenalty(words[end - 1] ?? '', words[end] ?? '');
        visit(
          end,
          count + 1,
          cost +
            boundary +
            FILL_WEIGHT * (1 - fillRatio(measured, layout.spec.maxLines)) ** 2,
        );
      }
    };
    visit(0, 0, 0);
    const minimum = Math.min(...possibilities.map(value => value.count));
    const optimum = Math.min(
      ...possibilities
        .filter(value => value.count === minimum)
        .map(value => value.cost),
    );
    const result = splitVerse(text, layout);
    const actual = result.chunks.reduce(
      (sum, chunk, i) =>
        sum +
        (chunk.continued
          ? boundaryPenalty(
              chunk.text.split(' ').at(-1) ?? '',
              result.chunks[i + 1]?.text.split(' ')[0] ?? '',
            )
          : 0) +
        FILL_WEIGHT * (1 - chunk.fillRatio) ** 2,
      0,
    );
    expect(result.nSlides).toBe(minimum);
    expect(actual).toBeCloseTo(optimum, 8);
  });

  it('measures first-slide numbers and the smaller marker through the injected layout', () => {
    const layout = mockSplitLayout(12, 2);
    const measure = vi.fn(layout.measure);
    const body = Array.from({length: 8}, () => '가나').join(' ');
    expect(splitVerse(body, layout).nSlides).toBe(1);
    const result = splitVerse(body, {...layout, measure}, {prefix: '176 '});
    expect(result.nSlides).toBeGreaterThan(1);
    expect(result.chunks[0]?.text).not.toContain('176');
    result.chunks.forEach((chunk, index) => {
      expect(
        layoutText(
          (index === 0 ? '176 ' : '') + chunk.text,
          layout,
          chunk.continued,
        ).fits,
      ).toBe(true);
    });
    expect(measure).toHaveBeenCalledWith(
      expect.stringContaining('176 '),
      expect.objectContaining({
        font: 'Mock font',
        size: 36,
        tracking: 0,
        width: 12,
        maxLines: 2,
        markerSize: 28,
      }),
    );
    expect(
      measure.mock.calls.some(([, spec]) => spec.marker === ' (계속)'),
    ).toBe(true);
  });

  it('fails bounded work explicitly without dropping text', () => {
    expect(() =>
      splitVerse('가 '.repeat(SPLIT_LIMITS.tokens + 1), mockSplitLayout()),
    ).toThrow('limit');
  });

  it('expands a word larger than a slide without splitting surrogate pairs', () => {
    const text = '가나다😀'.repeat(24);
    const layout = mockSplitLayout(12, 2);
    const result = splitVerse(text, layout);
    expect(result.nSlides).toBeGreaterThan(1);
    expect(result.chunks.map(chunk => chunk.text).join('')).toBe(text);
    for (const chunk of result.chunks) {
      expect(chunk.text).not.toMatch(/\p{Surrogate}/u);
      expect(layoutText(chunk.text, layout, chunk.continued).fits).toBe(true);
    }
  });

  it.each([
    {text: '가나다라마 아', width: 10, prefix: '176 '},
    {text: '가 아 나', width: 3, prefix: ''},
  ])(
    'refuses an impossible prefix or marker fit: $text',
    ({text, width, prefix}) => {
      expect(() =>
        splitVerse(text, mockSplitLayout(width, 1), {prefix}),
      ).toThrow('cannot fit');
    },
  );

  it('refuses oversized-word expansion at the token cap without expanding the remainder', () => {
    const text = '가'.repeat(20_000);
    const layout = mockSplitLayout(1, 1);
    let measurements = 0;
    expect(() =>
      splitVerse(text, {
        ...layout,
        measure: body => {
          measurements++;
          return {
            lines: [],
            lineWidths: [1],
            maxWidth: 1,
            nLines: body.length,
            fits: body.length <= 1,
          };
        },
      }),
    ).toThrow('token limit');
    const perToken = Math.ceil(Math.log2(text.length)) + 1;
    expect(measurements).toBeLessThanOrEqual(
      SPLIT_LIMITS.tokens * perToken + 2,
    );
    expect(measurements).toBeLessThan(SPLIT_LIMITS.measurements);
  });

  it('counts initial and expansion measurements in the same budget as DP', () => {
    const layout = mockSplitLayout(1_000, 1);
    let measurements = 0;
    expect(() =>
      splitVerse('가 '.repeat(SPLIT_LIMITS.tokens), {
        ...layout,
        measure: (body, spec) => {
          measurements++;
          const width = body.length + spec.marker.length;
          return {
            lines: [],
            lineWidths: [Math.min(width, spec.width)],
            maxWidth: spec.width,
            nLines: Math.ceil(width / spec.width),
            fits: width <= spec.width,
          };
        },
      }),
    ).toThrow('measurement limit');
    expect(measurements).toBe(SPLIT_LIMITS.measurements);
  });
});
