import {describe, expect, it} from 'vitest';
import {closeStepAfter} from './closePolicy';

describe('close policy after a flush', () => {
  it.each([
    ['flushed', 'close'],
    ['no-reply', 'close'],
    ['refused', 'warn'],
  ] as const)('answers %s with %s', (outcome, step) => {
    expect(closeStepAfter(outcome)).toBe(step);
  });
});
