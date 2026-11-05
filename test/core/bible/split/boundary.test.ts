import {describe, expect, it} from 'vitest';
import {
  boundaryPenalty,
  classifyEnding,
  penaltyLabel,
  tokenize,
} from '@core/bible/split/boundary';

describe('copible boundary classes', () => {
  it.each([
    ['끝났다.”', 'final'],
    ['걸어가려고', 'forward'],
    ['빛나도록', 'forward'],
    ['나무마다', 'particle'],
    ['바람처럼', 'particle'],
    ['길밖에', 'particle'],
    ['보다가', 'clause'],
    ['오거니와', 'clause'],
    ['같아서', 'clause'],
    ['있는데', 'clause'],
    ['하므로', 'clause'],
    ['할지라도', 'clause'],
    ['하였으나', 'clause'],
    ['길가', 'particle'],
    ['나무와', 'particle'],
    ['다', 'other'],
    ['끝났다', 'final'],
    ['웃으며', 'clause'],
    ['아이들은', 'particle'],
    ['나무', 'other'],
    ['123', 'other'],
  ])('classifies %s as %s', (word, expected) => {
    expect(classifyEnding(word)).toBe(expected);
  });

  it('keeps the original penalties, quotation, parallelism, and dependent-word adjustments', () => {
    expect(boundaryPenalty('끝났다.', '구름이')).toBe(0);
    expect(boundaryPenalty('끝났다', '하시니라')).toBe(14);
    expect(boundaryPenalty('높이나', '깊이나')).toBe(14);
    expect(boundaryPenalty('걸어가려고', '나왔다')).toBe(95);
    expect(boundaryPenalty('다른', '이야기')).toBe(80);
    expect(boundaryPenalty('그의', '이야기')).toBe(100);
    expect(boundaryPenalty('자를', '수')).toBe(100);
    expect(boundaryPenalty('나무', '것')).toBe(70);
    expect(boundaryPenalty('나무', '것들이많았다')).toBe(45);
    expect([0, 14, 45, 80, 95].map(penaltyLabel)).toEqual([
      '문장끝',
      '절경계',
      '어절',
      '조사뒤',
      '약함',
    ]);
  });

  it('retains UTF-16 offsets for whitespace tokens', () => {
    expect(tokenize(' 가나\t다😀 ')).toEqual([
      {text: '가나', start: 1, end: 3},
      {text: '다😀', start: 4, end: 7},
    ]);
  });
});
