import {expect, it} from 'vitest';
import {usageMeta} from './usageMeta';

it('hides zero usage and shows positive usage', () => {
  expect(usageMeta(0, '예배 순서 항목 0곳에서 씀')).toEqual([]);
  for (const count of [1, 3]) {
    const text = `예배 순서 항목 ${count}곳에서 씀`;
    expect(usageMeta(count, text)).toEqual([text]);
  }
});
