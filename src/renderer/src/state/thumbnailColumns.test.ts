import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LayoutChange} from '@shared/schema/uiState';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {seedThumbnailColumns, setThumbnailColumns, useShow} from './show';

const setLayout = vi.fn<(change: LayoutChange) => void>();

beforeEach(() => {
  setLayout.mockReset();
  window.llp = fakeLlpApi({
    ui: {get: () => Promise.resolve({}), setLayout},
  });
  useShow.setState({thumbnailColumns: {}});
});

afterEach(() => {
  delete window.llp;
});

describe('setThumbnailColumns', () => {
  it('sends the new number of columns of the size class once', () => {
    setThumbnailColumns('normal', 6);
    expect(useShow.getState().thumbnailColumns.normal).toBe(6);
    expect(setLayout).toHaveBeenCalledTimes(1);
    expect(setLayout).toHaveBeenCalledWith({sizeClass: 'normal', columns: 6});
  });

  it('sends only the columns, never the widths', () => {
    setThumbnailColumns('wide', 3);
    const change = setLayout.mock.calls[0]?.[0];
    expect(change).toEqual({sizeClass: 'wide', columns: 3});
    expect(change).not.toHaveProperty('left');
    expect(change).not.toHaveProperty('right');
  });

  it('sends nothing for the number that is already in effect', () => {
    setThumbnailColumns('normal', 4);
    expect(setLayout).not.toHaveBeenCalled();
    setThumbnailColumns('normal', 5);
    setThumbnailColumns('normal', 5);
    expect(setLayout).toHaveBeenCalledTimes(1);
  });

  it('clamps to 2 through 8 and rounds, and sends the clamped number', () => {
    setThumbnailColumns('normal', 1);
    setThumbnailColumns('normal', 20);
    setThumbnailColumns('narrow', 5.4);
    expect(setLayout.mock.calls.map(([change]) => change)).toEqual([
      {sizeClass: 'normal', columns: 2},
      {sizeClass: 'normal', columns: 8},
      {sizeClass: 'narrow', columns: 5},
    ]);
  });

  it('does not send a number that clamps to the one in effect', () => {
    setThumbnailColumns('normal', 8);
    setLayout.mockClear();
    setThumbnailColumns('normal', 30);
    expect(setLayout).not.toHaveBeenCalled();
  });

  it('works without the Electron API', () => {
    delete window.llp;
    setThumbnailColumns('normal', 7);
    expect(useShow.getState().thumbnailColumns.normal).toBe(7);
  });
});

describe('seedThumbnailColumns', () => {
  it('takes the saved columns of each size class and sends nothing', () => {
    seedThumbnailColumns({
      layout: {
        narrow: {columns: 2},
        normal: {left: 300, right: 500, columns: 5},
        wide: {columns: 8},
      },
    });
    expect(useShow.getState().thumbnailColumns).toEqual({
      narrow: 2,
      normal: 5,
      wide: 8,
    });
    expect(setLayout).not.toHaveBeenCalled();
  });

  it('keeps the default for a size class without saved columns', () => {
    seedThumbnailColumns({layout: {normal: {left: 300, right: 500}}});
    expect(useShow.getState().thumbnailColumns).toEqual({});
  });

  it('clamps a saved number that is out of range', () => {
    seedThumbnailColumns({layout: {normal: {columns: 1}, wide: {columns: 40}}});
    expect(useShow.getState().thumbnailColumns).toEqual({normal: 2, wide: 8});
  });

  it('starts from the defaults when nothing was saved', () => {
    seedThumbnailColumns({});
    expect(useShow.getState().thumbnailColumns).toEqual({});
  });

  it('replaces the numbers that were there before', () => {
    setThumbnailColumns('wide', 3);
    seedThumbnailColumns({layout: {normal: {columns: 6}}});
    expect(useShow.getState().thumbnailColumns).toEqual({normal: 6});
  });
});
