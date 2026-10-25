import {describe, expect, it} from 'vitest';
import {
  clampNumber,
  formatNumberText,
  parseNumberText,
  roundNumberToStep,
  stepNumber,
} from './numberText';

const range = {min: 0, max: 10};

describe('parseNumberText', () => {
  it('reads numbers with spaces and the suffix around them', () => {
    expect(parseNumberText(' 6 ', '')).toBe(6);
    expect(parseNumberText('6%', '%')).toBe(6);
    expect(parseNumberText('1.5 %', '%')).toBe(1.5);
  });

  it('finds nothing in empty or non-numeric text', () => {
    expect(parseNumberText('', '')).toBeUndefined();
    expect(parseNumberText('%', '%')).toBeUndefined();
    expect(parseNumberText('여섯', '')).toBeUndefined();
    expect(parseNumberText('Infinity', '')).toBeUndefined();
  });

  it.each(['1e2', '0x10', '+2', '1..2', '1,2', '1 2'])(
    'rejects text outside decimal field syntax: %s',
    text => {
      expect(parseNumberText(text, '')).toBeUndefined();
    },
  );

  it('accepts a leading minus and a decimal without an integer part', () => {
    expect(parseNumberText('-.25', '')).toBe(-0.25);
    expect(parseNumberText('.5×', '×')).toBe(0.5);
  });
});

describe('roundNumberToStep', () => {
  it.each([
    [0.26, 0.1, 0.3],
    [1.43, 0.05, 1.45],
    [0.15, 0.1, 0.2],
    [-0.15, 0.1, -0.1],
    [0.35, 0.1, 0.4],
    [-0.35, 0.1, -0.3],
  ])('rounds %s to step %s as %s', (value, step, expected) => {
    expect(roundNumberToStep(value, {step, range: {min: -2, max: 2}})).toBe(
      expected,
    );
  });

  it('clamps after step rounding, including bounds outside the step grid', () => {
    expect(
      roundNumberToStep(0.27, {
        step: 0.1,
        range: {min: 0.25, max: 0.28},
      }),
    ).toBe(0.28);
    expect(roundNumberToStep(-20, {step: 0.1, range})).toBe(0);
    expect(roundNumberToStep(20, {step: 0.1, range})).toBe(10);
  });
});

describe('clampNumber', () => {
  it('snaps values to the nearest end of the range', () => {
    expect(clampNumber(-1, range)).toBe(0);
    expect(clampNumber(11, range)).toBe(10);
    expect(clampNumber(5, range)).toBe(5);
  });
});

describe('stepNumber', () => {
  it('moves by whole steps and stays in the range', () => {
    expect(stepNumber(5, {step: 1, steps: 1, range})).toBe(6);
    expect(stepNumber(5, {step: 1, steps: 10, range})).toBe(10);
    expect(stepNumber(5, {step: 1, steps: -10, range})).toBe(0);
  });

  it('rounds away the error of decimal steps', () => {
    expect(stepNumber(1.1, {step: 0.1, steps: 1, range})).toBe(1.2);
    expect(stepNumber(0.2, {step: 0.1, steps: 1, range})).toBe(0.3);
  });

  it('preserves a continuous slider offset while adding a decimal step', () => {
    expect(stepNumber(0.26, {step: 0.1, steps: 1, range})).toBe(0.36);
  });

  it('reads small scientific-notation steps without rounding them to zero', () => {
    expect(stepNumber(2e-7, {step: 1e-7, steps: 1, range})).toBe(3e-7);
  });
});

describe('formatNumberText', () => {
  it('writes the value with its suffix', () => {
    expect(formatNumberText(6, '%')).toBe('6%');
    expect(formatNumberText(10, '')).toBe('10');
  });

  it('pads to the precision of the step', () => {
    expect(formatNumberText(1.4, '', 0.05)).toBe('1.40');
    expect(formatNumberText(1, '×', 0.05)).toBe('1.00×');
    expect(formatNumberText(0.2, '', 0.1)).toBe('0.2');
    expect(formatNumberText(2e-7, '', 1e-7)).toBe('0.0000002');
  });

  it.each([
    {value: 0.28, step: 0.1, suffix: '', text: '0.28'},
    {value: -0.28, step: 0.1, suffix: '%', text: '-0.28%'},
    {value: 0.25, step: 1, suffix: '×', text: '0.25×'},
  ])('preserves value precision in $text', ({value, step, suffix, text}) => {
    expect(formatNumberText(value, suffix, step)).toBe(text);
  });
});
