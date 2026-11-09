import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import type {MediaProgress} from '@core/schema/mediaProgress';
import {useLive} from '@renderer/session/live';
import {TestScreenSummaries} from '@fixtures/renderer/platform/screenSummaries';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {LiveMediaProgress} from '@renderer/features/presentation/LiveMediaProgress';

vi.mock('@renderer/features/presentation/ScreenPreview', () => ({
  ScreenPreview: () => null,
}));
afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
});

const reading: MediaProgress = {
  mediaId: 'video',
  startedAt: 0,
  positionSeconds: 12,
  durationSeconds: 54,
};

it('unsubscribes and hides while every output is off, ignoring late samples and resuming a fresh query', async () => {
  let push: (value: MediaProgress | null) => void = () => undefined;
  const unsubscribe = vi.fn();
  const query = vi.fn(() => Promise.resolve(reading));
  window.llp = mockLlpApi({
    live: {
      mediaProgress: query,
      subscribeMediaProgress: listener => {
        push = listener;
        return unsubscribe;
      },
    },
  });
  const empty = emptyLiveState();
  const state = {
    ...empty,
    outputs: {main: true},
    layers: {
      ...empty.layers,
      media: {mediaId: 'video', startedAt: 0, loop: true},
    },
  };
  useLive.setState({state});
  render(<LiveMediaProgress />);
  await screen.findByRole('progressbar');
  act(() => useLive.setState({state: {...state, outputs: {main: false}}}));
  expect(unsubscribe).toHaveBeenCalledOnce();
  act(() => push({...reading, positionSeconds: 30}));
  expect(screen.queryByRole('progressbar')).toBeNull();
  query.mockResolvedValue({...reading, positionSeconds: 40});
  act(() =>
    useLive.setState({state: {...state, outputs: {main: false, stage: true}}}),
  );
  await screen.findByText('0:40');
  expect(query).toHaveBeenCalledTimes(2);
});

it('shows the main-owned position below the preview and releases its subscription', async () => {
  let push: (value: MediaProgress | null) => void = () => undefined;
  const stop = vi.fn();
  window.llp = mockLlpApi({
    live: {
      mediaProgress: () => Promise.resolve(reading),
      subscribeMediaProgress: listener => {
        push = listener;
        return stop;
      },
    },
  });
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      outputs: {main: true},
      layers: {
        ...state.layers,
        media: {mediaId: 'video', startedAt: 0, loop: true},
      },
    },
  });
  const view = render(
    <TestScreenSummaries>
      <PreviewPanel />
    </TestScreenSummaries>,
  );
  const line = await screen.findByRole('progressbar', {
    name: '배경 영상 재생 위치',
  });
  expect(line.getAttribute('value')).toBe('12');
  expect(screen.getByText('0:12')).toBeDefined();
  expect(screen.getByText('-0:42')).toBeDefined();
  act(() => push({...reading, positionSeconds: 13}));
  expect(screen.getByText('0:13')).toBeDefined();
  expect(screen.getByText('-0:41')).toBeDefined();
  const observer = new MutationObserver(() => undefined);
  observer.observe(line.parentElement ?? line, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  act(() => push({...reading, positionSeconds: 13.2}));
  act(() => push({...reading, positionSeconds: 13.8}));
  expect(observer.takeRecords()).toEqual([]);
  observer.disconnect();
  act(() => push({...reading, positionSeconds: 47.2}));
  expect(screen.getByText('-0:07')).toBeDefined();
  act(() => push(null));
  expect(screen.queryByRole('progressbar')).toBeNull();
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it('keeps a pushed reading newer than the initial query and hides cleared or replaced media', async () => {
  let finish: (value: MediaProgress | null) => void = () => undefined;
  let push: (value: MediaProgress | null) => void = () => undefined;
  window.llp = mockLlpApi({
    live: {
      mediaProgress: () =>
        new Promise(resolve => {
          finish = resolve;
        }),
      subscribeMediaProgress: listener => {
        push = listener;
        return () => undefined;
      },
    },
  });
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      outputs: {main: true},
      layers: {
        ...state.layers,
        media: {mediaId: 'video', startedAt: 0, loop: true},
      },
    },
  });
  render(
    <TestScreenSummaries>
      <PreviewPanel />
    </TestScreenSummaries>,
  );
  act(() => push({...reading, positionSeconds: 20}));
  await act(async () => finish(reading));
  expect(screen.getByText('0:20')).toBeDefined();
  act(() => useLive.setState({state}));
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
});
