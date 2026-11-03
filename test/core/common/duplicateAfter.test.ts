import {describe, expect, it} from 'vitest';
import {duplicateAfter} from '@core/common/duplicateAfter';

const list = [
  {id: 'a', name: '찬양', extra: 1},
  {id: 'b', name: '말씀', extra: 2},
];

describe('duplicateAfter', () => {
  it('puts a copy with a new id and the copy name right after the original', () => {
    expect(duplicateAfter(list, {id: 'a', copyId: 'c'}, {limit: 10})).toEqual([
      {id: 'a', name: '찬양', extra: 1},
      {id: 'c', name: '찬양 복사본', extra: 1},
      {id: 'b', name: '말씀', extra: 2},
    ]);
  });

  it('numbers the copy when the name is taken, and copies a copy from its original', () => {
    const copies = duplicateAfter(list, {id: 'a', copyId: 'c'}, {limit: 10});
    const again = duplicateAfter(copies, {id: 'c', copyId: 'd'}, {limit: 10});
    expect(again.map(item => item.name)).toEqual([
      '찬양',
      '찬양 복사본',
      '찬양 복사본 2',
      '말씀',
    ]);
  });

  it('cuts the original to keep the copy within the longest name', () => {
    const long = [{id: 'a', name: '가'.repeat(256)}];
    const [, copy] = duplicateAfter(
      long,
      {id: 'a', copyId: 'c'},
      {limit: 10, maxName: 256},
    );
    expect(copy?.name).toHaveLength(256);
    expect(copy?.name.endsWith(' 복사본')).toBe(true);
  });

  it('leaves the list alone when the copy is already there', () => {
    const copies = duplicateAfter(list, {id: 'a', copyId: 'c'}, {limit: 10});
    expect(duplicateAfter(copies, {id: 'a', copyId: 'c'}, {limit: 10})).toBe(
      copies,
    );
  });

  it('refuses a missing original and a full list', () => {
    expect(() =>
      duplicateAfter(list, {id: 'gone', copyId: 'c'}, {limit: 10}),
    ).toThrow('no longer exists');
    expect(() =>
      duplicateAfter(list, {id: 'a', copyId: 'c'}, {limit: 2}),
    ).toThrow('is full');
  });
});
