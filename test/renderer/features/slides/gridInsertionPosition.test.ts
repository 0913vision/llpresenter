import {describe, expect, it, vi} from 'vitest';
import {
  gridInsertionPosition,
  emptySlideGap,
  visibleGridInsertionPosition,
  slideDropPosition,
} from '@renderer/features/slides/gridInsertionPosition';

describe('grid slide insertion positions', () => {
  const layout = {
    count: 7,
    leading: 0,
    columns: 4,
    width: 185,
    columnGap: 24,
    offsets: [0, 200, 430],
  };
  it('places the gap after slide three and before the first slide of row two', () => {
    expect(gridInsertionPosition({...layout, index: 3})).toEqual({
      top: 0,
      left: 619,
      height: 200,
    });
    expect(gridInsertionPosition({...layout, index: 4})).toEqual({
      top: 200,
      left: 0,
      height: 230,
    });
  });
  it('places the final gap after the last tile, including a leading section card', () => {
    expect(gridInsertionPosition({...layout, index: 7})).toEqual({
      top: 200,
      left: 603,
      height: 230,
    });
    expect(gridInsertionPosition({...layout, index: 7, leading: 1})).toEqual({
      top: 200,
      left: 812,
      height: 230,
    });
  });
  it('keeps a full-row end marker inside the viewport', () => {
    expect(
      visibleGridInsertionPosition({...layout, count: 4, index: 4}),
    ).toMatchObject({
      left: 'min(812px, calc(100% - 8px))',
    });
  });
  it('uses horizontal halves in grid mode and vertical halves in list mode', () => {
    const container = document.createElement('div');
    const row = document.createElement('div');
    row.dataset.editorBlock = '2';
    row.dataset.slideIndex = '2';
    container.append(row);
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({x: 10, y: 20, width: 100, height: 100}),
    );
    container.dataset.view = 'grid';
    expect(slideDropPosition(row, 90, 25)).toBe(3);
    expect(slideDropPosition(row, 20, 110)).toBe(2);
    container.dataset.view = 'list';
    expect(slideDropPosition(row, 90, 25)).toBe(2);
    expect(slideDropPosition(row, 20, 110)).toBe(3);
  });
  it('finds gaps at a row end, between rows and below the last slide', () => {
    const viewport = document.createElement('div');
    viewport.dataset.view = 'grid';
    (
      [
        [0, 0, 0],
        [1, 120, 0],
        [2, 0, 120],
      ] as const
    ).forEach(([index, x, y]) => {
      const node = document.createElement('div');
      node.dataset.slideIndex = String(index);
      vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({x, y, width: 100, height: 100}),
      );
      viewport.append(node);
    });
    expect(emptySlideGap(viewport, {x: 300, y: 160, count: 3})).toBe(3);
    expect(emptySlideGap(viewport, {x: 110, y: 50, count: 3})).toBe(1);
    expect(emptySlideGap(viewport, {x: 0, y: 250, count: 3})).toBe(3);
    viewport.dataset.view = 'list';
    expect(emptySlideGap(viewport, {x: 0, y: 110, count: 3})).toBe(1);
  });
});
