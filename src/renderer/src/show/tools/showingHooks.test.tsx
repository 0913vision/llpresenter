import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useLive} from '@renderer/state/live';
import {settingsDocument} from '@renderer/screens/testing/documents';
import {parseMediaDocument, type MediaDocument} from '@core/schema/mediaEdit';
import type {MediaId} from '@core/schema/ids';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {deferred} from '../quick/quickTesting';
import {stageFixture} from './stageTesting';
import {useShowingCount, useShowingGroups} from './showingHooks';

afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
  vi.useRealTimers();
});

it('updates the badge only when the next message expires', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2028-01-01T00:00:00Z'));
  const f = stageFixture();
  const now = Date.now();
  f.live({
    layers: {
      slide: null,
      media: null,
      prop: null,
      audio: null,
      notice: null,
      message: {
        messageId: '00000000-0000-4000-8000-000000000001',
        text: 'One',
        items: [
          {
            messageId: '00000000-0000-4000-8000-000000000001',
            text: 'One',
            targets: 'all',
            excludedTargets: [],
            startedAt: now,
            expiresAt: now + 3000,
          },
          {
            messageId: '00000000-0000-4000-8000-000000000002',
            text: 'Two',
            targets: 'all',
            excludedTargets: [],
            startedAt: now,
            expiresAt: now + 5000,
          },
        ],
      },
    },
  });
  let renders = 0;
  const {result} = renderHook(() => {
    renders++;
    return useShowingCount();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const before = result.current;
  const initialRenders = renders;
  act(() => {
    vi.advanceTimersByTime(2999);
  });
  expect(renders).toBe(initialRenders);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current).toBeLessThan(before);
  const afterFirst = result.current;
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(result.current).toBeLessThan(afterFirst);
});

it('keeps newer media pushes and ignores reads and callbacks after unmount', async () => {
  const f = stageFixture([
    settingsDocument('props', {props: []}),
    settingsDocument('notices', {sets: []}),
  ]);
  const original = window.llp;
  if (!original) throw new Error('Missing API');
  const makeDocument = (revision: number, name: string): MediaDocument => {
    const result = parseMediaDocument({
      name: 'media',
      revision,
      access: 'editable',
      value: {
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000009',
            name,
            kind: 'video',
            file: 'video.mp4',
            size: 1,
            duration: 30,
          },
        ],
        playlists: [],
        audioPlaylists: [],
      },
    });
    if (!result.ok) throw new Error('Invalid fixture');
    return result.value;
  };
  const read = deferred<MediaDocument>();
  const id = makeDocument(2, 'New').value.items[0]?.id;
  if (!id) throw new Error('Missing media fixture');
  const missingRead = deferred<readonly MediaId[]>();
  let push: (doc: MediaDocument) => void = () => undefined;
  let pushMissing: (ids: readonly MediaId[]) => void = () => undefined;
  const stop = vi.fn();
  const report = vi.fn();
  window.llp = fakeLlpApi({
    settings: original.settings,
    media: {
      get: () => read.promise,
      missing: () => missingRead.promise,
      subscribe: listener => {
        push = listener;
        return stop;
      },
      subscribeMissing: listener => {
        pushMissing = listener;
        return stop;
      },
    },
  });
  f.live({
    layers: {
      slide: null,
      media: {
        mediaId: '00000000-0000-4000-8000-000000000009',
        startedAt: Date.now(),
        loop: false,
      },
      prop: null,
      audio: null,
      message: null,
      notice: null,
    },
  });
  const {result, unmount} = renderHook(() => useShowingGroups(report));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  act(() => {
    push(makeDocument(2, 'New'));
    pushMissing([id]);
  });
  await act(async () => {
    read.resolve(makeDocument(1, 'Old'));
    missingRead.resolve([]);
    await Promise.all([read.promise, missingRead.promise]);
  });
  expect(
    result.current.groups
      .flatMap(group => group.items)
      .some(item => item.title === 'New'),
  ).toBe(true);
  expect(
    result.current.groups
      .flatMap(group => group.items)
      .find(item => item.title === 'New')?.icon,
  ).toBe('pause');
  unmount();
  act(() => {
    push(makeDocument(3, 'Later'));
    pushMissing([]);
  });
  expect(stop).toHaveBeenCalledTimes(2);
  expect(report).not.toHaveBeenCalled();
});

it('reports both media read failures while mounted', async () => {
  stageFixture([
    settingsDocument('props', {props: []}),
    settingsDocument('notices', {sets: []}),
  ]);
  const original = window.llp;
  if (!original) throw new Error('Missing API');
  const report = vi.fn();
  const write = vi.fn();
  window.llp = fakeLlpApi({
    settings: original.settings,
    log: {write},
    media: {
      get: async () => {
        throw new Error('read failed');
      },
      missing: async () => {
        throw new Error('check failed');
      },
    },
  });
  renderHook(() => useShowingGroups(report));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(report).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledTimes(2);
});
