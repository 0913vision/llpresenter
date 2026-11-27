import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useWindowActive} from '@renderer/app/shell/menubar/useWindowActive';

afterEach(() => {
  vi.restoreAllMocks();
});

it('turns off while another window has the focus and on again when it comes back (USER Nov 27)', () => {
  const focused = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  const view = renderHook(() => useWindowActive());
  expect(view.result.current).toBe(true);
  focused.mockReturnValue(false);
  act(() => {
    window.dispatchEvent(new Event('blur'));
  });
  expect(view.result.current).toBe(false);
  focused.mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(view.result.current).toBe(true);
});
