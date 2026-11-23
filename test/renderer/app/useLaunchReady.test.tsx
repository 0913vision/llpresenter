import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLaunchReady} from '@renderer/app/useLaunchReady';
import {LoadReadiness} from '@renderer/ui/loadReadiness';
import type {Preparation} from '@core/schema/launch';

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
    launch: {ready},
    service: {
      get: () =>
        new Promise(resolve => {
          loaded = () => resolve(null);
        }),
    },
  });
  const view = renderHook(() => useLaunchReady(api));
  expect(ready).not.toHaveBeenCalled();
  await act(async () => loaded());
  await act(async () => {
    frame(0);
    await Promise.resolve();
    await Promise.resolve();
    frame(16);
  });
  expect(ready).not.toHaveBeenCalled();
  act(() => idle({didTimeout: false, timeRemaining: () => 5}));
  expect(ready).toHaveBeenCalledOnce();
  view.unmount();
  expect(cancel).not.toHaveBeenCalled();
  idle({didTimeout: false, timeRemaining: () => 5});
  expect(ready).toHaveBeenCalledOnce();
});

it('waits for the tracked first reads before signaling', async () => {
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
  const readiness = new LoadReadiness();
  const finish = readiness.begin();
  const ready = vi.fn();
  const api = mockLlpApi({launch: {ready}});
  renderHook(() => useLaunchReady(api, readiness));
  await act(async () => Promise.resolve());
  expect(ready).not.toHaveBeenCalled();
  act(finish);
  await act(async () => {
    frame(0);
    await Promise.resolve();
    await Promise.resolve();
  });
  act(() => frame(16));
  act(() => idle({didTimeout: false, timeRemaining: () => 5}));
  expect(ready).toHaveBeenCalledOnce();
});

it('tells how far each of its tasks is', async () => {
  let frame: FrameRequestCallback = () => undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('requestIdleCallback', () => 2);
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const readiness = new LoadReadiness();
  const read = readiness.begin();
  const picture = readiness.begin('picture');
  const preparing = vi.fn<(value: Preparation) => void>();
  const api = mockLlpApi({launch: {preparing}});
  const last = (task: Preparation['task']): Preparation | undefined =>
    preparing.mock.calls
      .map(([value]) => value)
      .findLast(value => value.task === task);
  const view = renderHook(() => useLaunchReady(api, readiness));
  expect(last('data')).toMatchObject({done: 0, total: 2, ended: false});
  await act(async () => Promise.resolve());
  expect(last('data')).toMatchObject({done: 1, total: 2, ended: false});
  act(read);
  expect(last('data')).toMatchObject({done: 2, total: 2, ended: true});
  expect(last('pictures')).toMatchObject({done: 0, total: 1, ended: false});
  act(picture);
  expect(last('pictures')).toMatchObject({done: 1, total: 1, ended: true});
  await act(async () => {
    frame(0);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(last('fonts')).toMatchObject({done: 1, total: 1, ended: true});
  expect(last('drawing')).toMatchObject({ended: false});
  view.unmount();
});
