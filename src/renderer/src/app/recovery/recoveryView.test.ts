import {expect, it} from 'vitest';
import {recoveryRows, recoveryTime} from './recoveryView';
import {sampleOffer} from './testing';

it('names each offered row with what it would restore', () => {
  expect(recoveryRows(sampleOffer())).toEqual([
    {
      kind: 'outputs',
      icon: 'mplay',
      label: '화면 출력',
      value: '본 화면, 무대 화면',
    },
    {
      kind: 'slide',
      icon: 'slides',
      label: '마지막 슬라이드',
      value: '아침이 밝아 오네  2 / 9',
    },
    {
      kind: 'showing',
      icon: 'layers',
      label: '표시 중이던 항목',
      value: '메시지 1, 소품 1, 무대 메시지 1',
    },
  ]);
});

it('shows only the rows main offers, in its order', () => {
  expect(
    recoveryRows(sampleOffer(['outputs', 'showing'])).map(row => row.kind),
  ).toEqual(['outputs', 'showing']);
});

it.each([
  [new Date(2026, 9, 25, 11, 26), '10월 25일 오전 11:26'],
  [new Date(2026, 9, 25, 0, 5), '10월 25일 오전 12:05'],
  [new Date(2026, 9, 25, 12, 0), '10월 25일 오후 12:00'],
  [new Date(2026, 0, 3, 21, 9), '1월 3일 오후 9:09'],
])('writes %s as %s in local time', (date, text) => {
  expect(recoveryTime(date.toISOString())).toBe(text);
});
