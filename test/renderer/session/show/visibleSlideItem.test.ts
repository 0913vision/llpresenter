import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  onScrollGridToItem,
  revealSlideItem,
  scrollGridToItem,
  scrolledSlideItem,
} from '@renderer/session/show/visibleSlideItem';

afterEach(() => {
  vi.useRealTimers();
  revealSlideItem(null);
});

describe('the item a continuous grid shows', () => {
  it('is the item the grid was asked to scroll to at once, not the items it passes', () => {
    vi.useFakeTimers();
    const stop = onScrollGridToItem(() => undefined);
    revealSlideItem('first');
    scrollGridToItem('third');
    expect(scrolledSlideItem()).toBe('third');
    revealSlideItem('second');
    expect(scrolledSlideItem()).toBe('third');
    revealSlideItem('third');
    revealSlideItem('fourth');
    expect(scrolledSlideItem()).toBe('fourth');
    stop();
  });

  it('follows the grid again once the scroll had time to settle', () => {
    vi.useFakeTimers();
    const stop = onScrollGridToItem(() => undefined);
    scrollGridToItem('last');
    vi.advanceTimersByTime(1001);
    revealSlideItem('next-to-last');
    expect(scrolledSlideItem()).toBe('next-to-last');
    stop();
  });

  it('changes nothing without a continuous grid', () => {
    scrollGridToItem('third');
    expect(scrolledSlideItem()).toBeNull();
  });
});
