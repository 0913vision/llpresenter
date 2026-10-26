import {describe, expect, it} from 'vitest';
import type {ServiceRow} from '@renderer/show/model';
import {quickAddBefore} from './quickAddPosition';

const rows: readonly ServiceRow[] = [
  {kind: 'header', id: 'h1', title: '찬양'},
  {kind: 'song', id: 's1', title: 'A'},
  {kind: 'song', id: 's2', title: 'B'},
  {kind: 'header', id: 'h2', title: '말씀'},
  {kind: 'bible', id: 'b1', title: 'C'},
];

describe('quick add position', () => {
  it('appends inside selected empty, consecutive and final sections', () => {
    const sections: readonly ServiceRow[] = [
      {kind: 'header', id: 'empty', title: '빈 구역'},
      {kind: 'header', id: 'next', title: '다음 구역'},
      ...rows,
      {kind: 'header', id: 'last', title: '마지막 구역'},
    ];
    expect(quickAddBefore(sections, 'empty')).toBe('next');
    expect(quickAddBefore(sections, 'next')).toBe('h1');
    expect(quickAddBefore(sections, 'last')).toBeNull();
  });

  it('goes before the header that ends the selected item group', () => {
    expect(quickAddBefore(rows, 's1')).toBe('h2');
    expect(quickAddBefore(rows, 's2')).toBe('h2');
  });

  it('goes to the end in the last group or without a selection', () => {
    expect(quickAddBefore(rows, 'b1')).toBeNull();
    expect(quickAddBefore(rows, null)).toBeNull();
    expect(quickAddBefore(rows, 'gone')).toBeNull();
  });
});
