import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useSizeClass} from '@renderer/app/shell/useSizeClass';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSizeClass', () => {
  it('follows the effective CSS viewport width on resize', () => {
    vi.stubGlobal('innerWidth', 1920);
    const {result} = renderHook(() => useSizeClass());
    expect(result.current).toBe('normal');

    vi.stubGlobal('innerWidth', 960);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe('narrow');
  });
});
