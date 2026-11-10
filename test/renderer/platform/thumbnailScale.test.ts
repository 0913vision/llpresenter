import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LayoutChange} from '@core/schema/uiState';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  createThumbnailScaleStore,
  saveThumbnailScale,
  seedThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/platform/thumbnailScale';

const setLayout = vi.fn<(change: LayoutChange) => void>();

function scaleOf(sizeClass: 'narrow' | 'normal' | 'wide'): number {
  return renderHook(() => useThumbnailScale(sizeClass)).result.current;
}

beforeEach(() => {
  setLayout.mockReset();
  window.llp = mockLlpApi({ui: {setLayout}});
  seedThumbnailScale({});
});

afterEach(() => {
  delete window.llp;
});

describe('thumbnail scale', () => {
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
        wide: {},
      },
    });
    expect([scaleOf('narrow'), scaleOf('normal'), scaleOf('wide')]).toEqual([
      80, 200, 100,
    ]);
    saveThumbnailScale('narrow', 80);
    expect(setLayout).not.toHaveBeenCalled();
  });
});

it('keeps independently created scale stores and persisted fields separate', () => {
  const show = createThumbnailScaleStore('thumbnailScalePercent');
  const details = createThumbnailScaleStore('detailsSlideScalePercent');
  const saved = {
    layout: {
      normal: {
        thumbnailScalePercent: 75,
        detailsSlideScalePercent: 135,
        editorSlideScalePercent: 180,
      },
    },
  };
  show.seed(saved);
  details.seed(saved);
  expect(renderHook(() => show.use('normal')).result.current).toBe(75);
  expect(renderHook(() => details.use('normal')).result.current).toBe(135);
  details.save('normal', 162.4, {setLayout});
  expect(setLayout).toHaveBeenCalledExactlyOnceWith({
    sizeClass: 'normal',
    detailsSlideScalePercent: 162,
  });
  expect(renderHook(() => show.use('normal')).result.current).toBe(75);
  details.seed({
    layout: {
      normal: {detailsSlideScalePercent: 162},
      wide: {detailsSlideScalePercent: 200},
    },
  });
  expect(renderHook(() => details.use('normal')).result.current).toBe(162);
  expect(renderHook(() => details.use('wide')).result.current).toBe(200);
  expect(renderHook(() => details.use('narrow')).result.current).toBe(100);
});
