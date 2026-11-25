import {describe, expect, it} from 'vitest';
import {
  sectionBoundaryIndex,
  sectionDropIndex,
} from '@core/services/serviceSections';

function isHeader(row: string): boolean {
  return row.startsWith('#');
}

describe('sectionBoundaryIndex', () => {
  it('moves an insertion inside a section up to that section’s header', () => {
    const rows = ['#1부', '찬양', '기도', '#2부', '말씀'];
    expect(sectionBoundaryIndex(rows, 2, isHeader)).toBe(0);
    expect(sectionBoundaryIndex(rows, 4, isHeader)).toBe(3);
    expect(sectionBoundaryIndex(rows, 3, isHeader)).toBe(3);
  });

  it('moves an insertion above the first header to that header, and one in a list without headers to the end', () => {
    expect(sectionBoundaryIndex(['광고', '#1부', '찬양'], 0, isHeader)).toBe(1);
    expect(sectionBoundaryIndex(['찬양', '기도'], 1, isHeader)).toBe(2);
  });

  it('leaves an index outside the rows as it is', () => {
    const rows = ['#1부', '찬양'];
    expect(sectionBoundaryIndex(rows, -1, isHeader)).toBe(-1);
    expect(sectionBoundaryIndex(rows, 2, isHeader)).toBe(2);
  });
});

describe('sectionDropIndex', () => {
  const rows = ['#1부', '찬양', '기도', '#2부', '말씀'];

  it('lands a moved section at the start of the section a drop falls in', () => {
    expect(sectionDropIndex(rows, {requested: 2, after: false}, isHeader)).toBe(
      0,
    );
    expect(sectionDropIndex(rows, {requested: 4, after: false}, isHeader)).toBe(
      3,
    );
  });

  it('never snaps a drop on the lower half of a row back above it', () => {
    expect(sectionDropIndex(rows, {requested: 2, after: true}, isHeader)).toBe(
      3,
    );
    expect(sectionDropIndex(rows, {requested: 4, after: true}, isHeader)).toBe(
      5,
    );
  });
});
