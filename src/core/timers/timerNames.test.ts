import {expect, it} from 'vitest';
import {nextTimerName} from './timerNames';

it('uses the first available numbered name without changing existing names', () => {
  expect(nextTimerName([])).toBe('타이머 1');
  expect(nextTimerName(['타이머 1', '설교', '타이머 3'])).toBe('타이머 2');
  const names = Array.from({length: 500}, (_, index) => `타이머 ${index + 1}`);
  expect(nextTimerName(names)).toBe('타이머 501');
  expect(names).toHaveLength(500);
});
