import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {useSlideTransitionProgress} from '@renderer/features/presentation/useSlideTransitionProgress';

afterEach(() => {
  vi.useRealTimers();
  useLive.setState({state: null});
});

it('tracks the shortened wipe, restarts and hides for cuts', () => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const state = emptyLiveState();
  const slide = {
    itemId: 'one',
    position: 0,
    label: null,
    lines: ['one'],
    transition: {kind: 'wipe' as const, sec: 4},
    transitionStartedAt: 10_000,
  };
  useLive.setState({state: {...state, layers: {...state.layers, slide}}});
  const {result} = renderHook(() => useSlideTransitionProgress());
  act(() => {
    vi.advanceTimersByTime(1660);
  });
  expect(result.current).toBeCloseTo(0.5, 1);
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {...slide, position: 1, transitionStartedAt: Date.now()},
        },
      },
    }),
  );
  act(() => {
    vi.advanceTimersByTime(32);
  });
  expect(result.current).toBeLessThan(0.02);
  act(() => {
    vi.advanceTimersByTime(3400);
  });
  expect(result.current).toBeUndefined();
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {...slide, transition: {kind: 'none', sec: 4}},
        },
      },
    }),
  );
  expect(result.current).toBeUndefined();
});
