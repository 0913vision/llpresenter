import {describe, expect, it, vi} from 'vitest';
import {
  gridInsertionPosition,
  slideDropPosition,
} from '@renderer/features/songs/editor/gridInsertionPosition';

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
});
