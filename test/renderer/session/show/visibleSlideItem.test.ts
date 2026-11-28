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

  it('keeps the pick through a smooth scroll longer than a second, to the end', () => {
    vi.useFakeTimers();
    const stop = onScrollGridToItem(() => undefined);
    revealSlideItem('first');
    scrollGridToItem('third');
    for (let frame = 0; frame < 120; frame += 1) {
      vi.advanceTimersByTime(16);
      revealSlideItem('second');
    }
    revealSlideItem('third');
    expect(picked()).toBe('third');
    expect(scrolledSlideItem()).toBe('third');
    stop();
  });

  it('keeps the pick where a scroll came to rest short of its item, at the end of the list', () => {
    vi.useFakeTimers();
    const stop = onScrollGridToItem(() => undefined);
    revealSlideItem('first');
    scrollGridToItem('last');
    revealSlideItem('next-to-last');
    vi.advanceTimersByTime(1001);
    revealSlideItem('next-to-last');
    expect(picked()).toBe('last');
    revealSlideItem('first');
    expect(picked()).toBeNull();
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
