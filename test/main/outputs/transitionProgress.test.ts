import {expect, it} from 'vitest';
import {transitionProgress} from '../../../src/main/presenter/transitionProgress.cjs';

it('finishes a four-second transition on time even when frames arrive late', () => {
  const start = 1000;
  const duration = 4000;
  expect(transitionProgress(start, duration, start)).toBe(0);
  expect(transitionProgress(start, duration, start + 2500)).toBe(0.625);
  expect(transitionProgress(start, duration, start + 3999)).toBeCloseTo(0.99975);
  expect(transitionProgress(start, duration, start + 4000)).toBe(1);
  expect(transitionProgress(start, duration, start + 6000)).toBe(1);
});
