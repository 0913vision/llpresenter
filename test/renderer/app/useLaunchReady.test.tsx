import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLaunchReady} from '@renderer/app/useLaunchReady';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('signals only after service loading, paint and renderer idle, and cancels on unmount', async () => {
  let frame: FrameRequestCallback = () => undefined;
  let idle: IdleRequestCallback = () => undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    idle = callback;
    return 2;
  });
  const cancel = vi.fn();
  vi.stubGlobal('cancelIdleCallback', cancel);
  const ready = vi.fn();
  let loaded: () => void = () => undefined;
  const api = mockLlpApi({
    service: {
      ready,
      get: () =>
        new Promise(resolve => {
          loaded = () => resolve(null);
        }),
    },
  });
  const view = renderHook(() => useLaunchReady(api));
  expect(ready).not.toHaveBeenCalled();
  await act(async () => loaded());
  act(() => {
    frame(0);
    frame(16);
  });
  expect(ready).not.toHaveBeenCalled();
  act(() => idle({didTimeout: false, timeRemaining: () => 5}));
  expect(ready).toHaveBeenCalledOnce();
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(2);
  idle({didTimeout: false, timeRemaining: () => 5});
  expect(ready).toHaveBeenCalledOnce();
});
