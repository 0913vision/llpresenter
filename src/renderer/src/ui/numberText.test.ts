import {describe, expect, it} from 'vitest';
import {
  clampNumber,
  formatNumberText,
  parseNumberText,
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
});

describe('formatNumberText', () => {
  it('writes the value with its suffix', () => {
    expect(formatNumberText(6, '%')).toBe('6%');
    expect(formatNumberText(10, '')).toBe('10');
  });
});
