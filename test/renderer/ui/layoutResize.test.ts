import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  beginLayoutResize,
  endLayoutResize,
  isLayoutResizeActive,
  onLayoutResizeEnd,
} from '@renderer/ui/layoutResize';

afterEach(() => {
  endLayoutResize();
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('layout resize', () => {
  it('refreshes once after both a window resize and panel drag have finished', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const unsubscribe = onLayoutResizeEnd(refresh);
    beginLayoutResize();
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event('resize'));
    endLayoutResize();
    expect(isLayoutResizeActive()).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(isLayoutResizeActive()).toBe(false);
    expect(refresh).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('does not notify a removed listener', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const unsubscribe = onLayoutResizeEnd(refresh);
    beginLayoutResize();
    unsubscribe();
    endLayoutResize();
    expect(refresh).not.toHaveBeenCalled();
  });
});
