import {shownText} from '@fixtures/core/liveSlide';
import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/schema/live/live';
import {useLive} from '@renderer/session/live';
import {useSlideTransitionProgress} from '@renderer/features/presentation/useSlideTransitionProgress';
import {progressStyle} from '@renderer/ui/tiles/transitionProgress';

afterEach(() => {
  vi.useRealTimers();
  useLive.setState({state: null});
});

it('tracks the full wipe duration, restarts and hides for cuts', () => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const state = emptyLiveState();
  const slide = {
    itemId: 'one',
    position: 0,
    ...shownText(['one']),
    transition: {kind: 'wipe' as const, sec: 4},
    transitionStartedAt: 10_000,
  };
  useLive.setState({state: {...state, layers: {...state.layers, slide}}});
  let renders = 0;
  const {result} = renderHook(() => {
    renders++;
    return useSlideTransitionProgress();
  });
  const initialRenders = renders;
  const initial = result.current;
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(result.current).toEqual({startedAt: 10_000, duration: 4000});
  expect(result.current).toBe(initial);
  expect(renders).toBe(initialRenders);
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
  expect(result.current).toEqual({startedAt: 12_000, duration: 4000});
  act(() => {
    vi.advanceTimersByTime(3900);
  });
  expect(result.current).toEqual({startedAt: 12_000, duration: 4000});
  act(() => {
    vi.advanceTimersByTime(96);
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

it('starts the bar at the elapsed time when it mounts late', () => {
  vi.useFakeTimers();
  vi.setSystemTime(12_000);
  expect(progressStyle({startedAt: 10_000, duration: 4000})).toEqual({
    animationDuration: '4000ms',
    animationDelay: '-2000ms',
  });
  expect(progressStyle({startedAt: 12_100, duration: 4000})).toEqual({
    animationDuration: '4000ms',
    animationDelay: '100ms',
  });
});
