import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {
  OutputScreenStatus,
  OutputStatuses,
} from '@core/schema/live/outputStatus';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

function status(contentSize?: {
  width: number;
  height: number;
}): OutputScreenStatus {
  return {
    placement: 'fullscreen',
    renderer: 'running',
    fps: 60,
    fpsLow: false,
    ...(contentSize === undefined ? {} : {contentSize}),
  };
}

let push: (statuses: OutputStatuses) => void = () => undefined;

beforeEach(() => {
  // NOTE(0913vision): The sizes are followed once per window, so each test
  // reads a fresh copy of the module.
  vi.resetModules();
  window.llp = mockLlpApi({
    output: {
      getStatus: () =>
        Promise.resolve({main: status({width: 1920, height: 1080})}),
      subscribeStatus: listener => {
        push = listener;
        return () => undefined;
      },
    },
  });
});
afterEach(() => {
  delete window.llp;
});

async function size(id: string, saved?: {width: number; height: number}) {
  const {useScreenSize} = await import('@renderer/pictures/screenSizes');
  return renderHook(() => useScreenSize(id, saved));
}

it('gives the size the output really has', async () => {
  const hook = await size('main', {width: 1280, height: 720});
  await waitFor(() =>
    expect(hook.result.current).toEqual({width: 1920, height: 1080}),
  );
});

it('gives the saved size while the output reports none, and follows a new size', async () => {
  const hook = await size('stage', {width: 1280, height: 720});
  await waitFor(() =>
    expect(hook.result.current).toEqual({width: 1280, height: 720}),
  );
  act(() => push({stage: status({width: 3840, height: 2160})}));
  expect(hook.result.current).toEqual({width: 3840, height: 2160});
  act(() => push({stage: status()}));
  expect(hook.result.current).toEqual({width: 1280, height: 720});
});
