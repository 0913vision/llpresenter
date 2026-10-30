import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LayoutChange} from '@core/schema/uiState';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {
  saveThumbnailScale,
  seedThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from './thumbnailScale';

const setLayout = vi.fn<(change: LayoutChange) => void>();

function scaleOf(sizeClass: 'narrow' | 'normal' | 'wide'): number {
  return renderHook(() => useThumbnailScale(sizeClass)).result.current;
}

beforeEach(() => {
  setLayout.mockReset();
  window.llp = fakeLlpApi({ui: {setLayout}});
  seedThumbnailScale({});
});

afterEach(() => {
  delete window.llp;
});

describe('thumbnail scale', () => {
  it('starts every size class at 100%', () => {
    expect([scaleOf('narrow'), scaleOf('normal'), scaleOf('wide')]).toEqual([
      100, 100, 100,
    ]);
  });

  it('shows a dragged size with its fraction, clamped, and saves nothing', () => {
    showThumbnailScale('normal', 137.4);
    expect(scaleOf('normal')).toBe(137.4);
    showThumbnailScale('normal', 500);
    expect(scaleOf('normal')).toBe(200);
    showThumbnailScale('normal', 10);
    expect(scaleOf('normal')).toBe(50);
    expect(setLayout).not.toHaveBeenCalled();
  });

  it('saves a finished size as a whole percentage of its size class only', () => {
    showThumbnailScale('wide', 137.4);
    saveThumbnailScale('wide', 137.4);
    expect(scaleOf('wide')).toBe(137);
    expect(scaleOf('normal')).toBe(100);
    expect(setLayout).toHaveBeenCalledExactlyOnceWith({
      sizeClass: 'wide',
      thumbnailScalePercent: 137,
    });
  });

  it('sends a saved size only once', () => {
    saveThumbnailScale('normal', 120);
    saveThumbnailScale('normal', 120.2);
    saveThumbnailScale('normal', 100);
    saveThumbnailScale('narrow', 100);
    expect(setLayout.mock.calls).toEqual([
      [{sizeClass: 'normal', thumbnailScalePercent: 120}],
      [{sizeClass: 'normal', thumbnailScalePercent: 100}],
    ]);
  });

  it('takes the saved sizes from the UI state, whole and clamped, without sending', () => {
    seedThumbnailScale({
      layout: {
        narrow: {thumbnailScalePercent: 80},
        normal: {thumbnailScalePercent: 999},
        wide: {columns: 3},
      },
    });
    expect([scaleOf('narrow'), scaleOf('normal'), scaleOf('wide')]).toEqual([
      80, 200, 100,
    ]);
    saveThumbnailScale('narrow', 80);
    expect(setLayout).not.toHaveBeenCalled();
  });
});
