import {describe, expect, it} from 'vitest';
import {hymnAt, hymnLabel, isTitleOf} from '@core/hymns';

function read(row: string) {
  const named = hymnAt(row);
  return named === null ? null : [hymnLabel(named.hymn), named.rest];
}

describe('the hymn of a row', () => {
  it.each([
    ['새찬송가 91장', '새찬송가 91장', ''],
    ['새 찬송가 91 장', '새찬송가 91장', ''],
    ['찬송가 91장', '새찬송가 91장', ''],
    ['91장 슬픈 마음 있는 사람', '새찬송가 91장', '슬픈 마음 있는 사람'],
    ['새찬송가 91장 (슬픈 마음)', '새찬송가 91장', '슬픈 마음'],
    ['통일찬송가 204장', '통일찬송가 204장', ''],
    ['통일 204장', '통일찬송가 204장', ''],
    ['구찬송가 204장', '통일찬송가 204장', ''],
  ])('reads %s', (row, label, rest) => {
    expect(read(row)).toEqual([label, rest]);
  });

  it.each(['슬픈 마음 있는 사람', '새찬송가 646장', '통일찬송가 559장', '0장'])(
    'is not in %s',
    row => {
      expect(hymnAt(row)).toBeNull();
    },
  );
});

it('has the title of its own hymnal', () => {
  expect(hymnAt('새찬송가 91장')?.hymn.title).toBe('슬픈 마음 있는 사람');
  expect(hymnAt('새찬송가 1장')?.hymn.title).toBe('만복의 근원 하나님');
  expect(hymnAt('새찬송가 645장')?.hymn.title).toBe('일곱 번 아멘');
  expect(hymnAt('통일찬송가 6장')?.hymn.title).toBe('찬양 성부 성자 성령');
  expect(hymnAt('통일찬송가 558장')?.hymn.title).toBe('일곱 번 아멘');
});

it('knows its title however it is spaced', () => {
  const hymn = hymnAt('새찬송가 182장')?.hymn;
  if (hymn === undefined) throw new Error('no hymn');
  expect(isTitleOf(hymn, '강물 같이 흐르는 기쁨')).toBe(true);
  expect(isTitleOf(hymn, '강물 같이 넘치는 기쁨')).toBe(false);
});
