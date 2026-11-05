import {describe, expect, it} from 'vitest';
import {contSizeOf, stepDownSize} from '@core/bible/split/layout';
import {
  cutsFromChunks,
  goodBoundaries,
  normalizeCuts,
  planSlides,
  wordsOf,
} from '@core/bible/split/manualSplit';
import {
  effectiveCuts,
  hintCharFromEvent,
  hintLabels,
  initialCutState,
  initialEditHistory,
  isShowingAuto,
  pressGap,
  redoEdit,
  toggleCutState,
  undoEdit,
} from '@core/bible/split/cutState';
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';

describe('copible manual cut planning', () => {
  const layout = mockSplitLayout();

  it('uses the exact size ladder, two steps down including unlisted sizes', () => {
    expect([
      stepDownSize(36, 2),
      stepDownSize(40, 2),
      stepDownSize(44, 1),
      stepDownSize(35, 2),
      stepDownSize(9, 3),
      stepDownSize(8, 2),
      stepDownSize(36, 0),
    ]).toEqual([28, 32, 40, 28, 8, 8, 36]);
    expect(contSizeOf({size: 36})).toBe(28);
  });

  it('normalizes whitespace and cuts, without accepting fractional indices', () => {
    expect(wordsOf(' 가나 \n 다라 ').map(word => word.text)).toEqual([
      '가나',
      '다라',
    ]);
    expect(normalizeCuts([5, 2, 5, 0, 9, 12, 1.5, NaN], 10)).toEqual([2, 5, 9]);
  });

  it('reports a fixing spill index and the remaining minimum number of cuts', () => {
    const none = planSlides(MOCK_LONG_VERSE, [], layout);
    expect(none.ok).toBe(false);
    expect(none.extraNeeded).toBeGreaterThanOrEqual(2);
    const spillAt = none.slides[0]?.problem?.spillAt;
    if (spillAt === null || spillAt === undefined) {
      throw Error('Expected a spill point');
    }
    const once = planSlides(MOCK_LONG_VERSE, [spillAt], layout);
    expect(once.slides[0]?.fits).toBe(true);
    expect(once.extraNeeded).toBe(none.extraNeeded - 1);
  });

  it('distinguishes marker-only overflow and omits the marker on the last slide', () => {
    const plan = planSlides('가나다 라마바 사아자', [2], mockSplitLayout(8, 1));
    expect(plan.slides[0]?.problem?.byMarker).toBe(true);
    expect(plan.slides[0]?.problem?.spillAt).toBe(1);
    expect(plan.slides.at(-1)?.lines.join(' ')).not.toContain('(계속)');
  });

  it('measures the number on the first part only', () => {
    const tight = mockSplitLayout(7, 1);
    expect(planSlides('가나다 라마바', [], tight).ok).toBe(true);
    expect(planSlides('가나다 라마바', [], {...tight, prefix: '176 '}).ok).toBe(
      false,
    );
    const parts = planSlides('가 가나다 라마바', [1], {
      ...tight,
      prefix: '176 ',
    });
    expect(parts.slides[1]?.fits).toBe(true);
    expect(parts.slides[1]?.text).toBe('가나다 라마바');
    expect(
      goodBoundaries(wordsOf('아침이 밝았다. 나무가 자라며 꽃이 피었다')),
    ).toContain(2);
    expect(
      cutsFromChunks([{text: '가 나'}, {text: '다 라'}, {text: '마'}]),
    ).toEqual([2, 4]);
  });
});

describe('copible cut state, history, and hints', () => {
  it('moves an auto cut and returns to it when the new cut is removed', () => {
    const initial = initialCutState([9]);
    expect(isShowingAuto(initial)).toBe(true);
    const moved = toggleCutState(initial, 14);
    expect(effectiveCuts(moved)).toEqual([14]);
    expect(effectiveCuts(toggleCutState(moved, 14))).toEqual([9]);
  });

  it('dismisses auto only on its own gap and retains remaining auto cuts', () => {
    const dismissed = toggleCutState(initialCutState([9]), 9);
    expect(effectiveCuts(dismissed)).toEqual([]);
    expect(
      effectiveCuts(toggleCutState(toggleCutState(dismissed, 14), 14)),
    ).toEqual([]);
    const multiple = toggleCutState(initialCutState([9, 20]), 9);
    expect(effectiveCuts(multiple)).toEqual([20]);
    expect(effectiveCuts(toggleCutState(multiple, 14))).toEqual([14, 20]);
    expect(effectiveCuts(toggleCutState(initialCutState([]), 3))).toEqual([3]);
  });

  it('undoes and redoes states and discards redo after a new edit', () => {
    const initial = initialEditHistory([9]);
    const pressed = pressGap(pressGap(initial, 14), 20);
    expect(effectiveCuts(undoEdit(pressed).present)).toEqual([14]);
    expect(effectiveCuts(undoEdit(undoEdit(pressed)).present)).toEqual([9]);
    expect(redoEdit(undoEdit(pressed))).toEqual(pressed);
    const branch = pressGap(undoEdit(pressed), 5);
    expect(redoEdit(branch)).toBe(branch);
    expect(undoEdit(initial)).toBe(initial);
    expect(redoEdit(initial)).toBe(initial);
  });

  it('uses home-row-first labels, then digits, and uniformly two letters past 36', () => {
    expect(hintLabels(5)).toEqual(['a', 's', 'd', 'f', 'g']);
    expect(hintLabels(36).slice(26)).toEqual(Array.from('1234567890'));
    const many = hintLabels(40);
    expect(many[0]).toBe('aa');
    expect(new Set(many).size).toBe(40);
    expect(many.every(label => label.length === 2)).toBe(true);
    expect(
      ['KeyA', 'KeyS', 'Digit1', 'Space'].map(code =>
        hintCharFromEvent({code}),
      ),
    ).toEqual(['a', 's', '1', null]);
  });
});
