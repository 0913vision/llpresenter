import {expect, it} from 'vitest';
import {countedMeta} from '@renderer/ui/countedMeta';

it('hides a zero count and shows a positive count', () => {
  expect(countedMeta(0, '예배 순서 항목 0곳에서 씀')).toEqual([]);
  for (const count of [1, 3]) {
    const text = `예배 순서 항목 ${count}곳에서 씀`;
    expect(countedMeta(count, text)).toEqual([text]);
  }
});
