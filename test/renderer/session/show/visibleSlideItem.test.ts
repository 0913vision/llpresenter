import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import {
  onScrollGridToItem,
  revealSlideItem,
  scrollGridToItem,
  scrolledSlideItem,
  usePickedSlideItem,
} from '@renderer/session/show/visibleSlideItem';

function picked(): string | null {
  return renderHook(() => usePickedSlideItem()).result.current?.id ?? null;
}

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

  it('keeps the row picked by a scroll request after the grid gets there, and drops it on a scroll of the operator', () => {
    vi.useFakeTimers();
    const stop = onScrollGridToItem(() => undefined);
    revealSlideItem('first');
    scrollGridToItem('third');
    expect(picked()).toBe('third');
    revealSlideItem('second');
    revealSlideItem('third');
    expect(picked()).toBe('third');
    revealSlideItem('fourth');
    expect(picked()).toBeNull();
    stop();
  });
});
