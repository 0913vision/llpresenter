import {describe, expect, it} from 'vitest';
import {hymnAt, hymnLabel, hymnTitle, isTitleOf} from '@core/hymns';
import {HYMN_COUNTS} from '@core/schema/hymn';

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
  expect(hymnTitle({hymnal: 'new', number: 91})).toBe('슬픈 마음 있는 사람');
  expect(hymnTitle({hymnal: 'new', number: 1})).toBe('만복의 근원 하나님');
  expect(hymnTitle({hymnal: 'unified', number: 6})).toBe('찬양 성부 성자 성령');
});

it.each(['new', 'unified'] as const)('has every title of %s', hymnal => {
  const count = HYMN_COUNTS[hymnal];
  const titles = Array.from({length: count}, (_, index) =>
    hymnTitle({hymnal, number: index + 1}),
  );
  expect(titles.filter(title => title.trim() === '')).toEqual([]);
  expect(hymnTitle({hymnal, number: count + 1})).toBe('');
});

it('knows its title however it is spaced', () => {
  const hymn = {hymnal: 'new', number: 182} as const;
  expect(isTitleOf(hymn, '강물 같이 흐르는 기쁨')).toBe(true);
  expect(isTitleOf(hymn, '강물 같이 넘치는 기쁨')).toBe(false);
});
