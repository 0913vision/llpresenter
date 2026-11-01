import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {MediaImportProgress} from '@core/schema/mediaEdit';
import {createMediaId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useFileMediaImport} from '@renderer/app/shell/useFileMediaImport';
import type {Notice} from '@renderer/ui/notices';

it('explains a missing import connection and a pending import request', async () => {
  delete window.llp;
  const {result, unmount} = renderHook(() => useFileMediaImport(vi.fn()));
  expect(result.current).toMatchObject({
    disabled: true,
    title: '미디어 가져오기 연결 안 됨',
  });
  unmount();
  window.llp = mockLlpApi({media: {import: () => new Promise(() => {})}});
  const pending = renderHook(() => useFileMediaImport(vi.fn()));
  act(() => pending.result.current.onSelect?.());
  expect(pending.result.current).toMatchObject({
    disabled: true,
    title: '미디어를 가져오는 중',
  });
  pending.unmount();
});

const failed: MediaImportProgress = {
  mediaId: createMediaId('00000000-0000-4000-8000-000000000001'),
  fileName: 'invented.mp4',
  phase: 'failed',
  percent: 25,
  message: 'Invented analysis failure',
};
afterEach(() => {
  cleanup();
  delete window.llp;
});

it.each([true, false])(
  'reports an import failure whether the request returns it, returned=%s',
  async returned => {
    const listeners = new Set<(progress: MediaImportProgress) => void>();
    const push = (progress: MediaImportProgress): void => {
      for (const listener of listeners) listener(progress);
    };
    const importMedia = vi.fn(async () => ({
      ok: true as const,
      value: [returned ? failed : {...failed, phase: 'copying' as const}],
    }));
    window.llp = mockLlpApi({
      media: {
        import: importMedia,
        subscribeImports: listener => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
    });
    const onProblem = vi.fn<(notice: Notice) => void>();
    const {result} = renderHook(() => useFileMediaImport(onProblem));

    act(() => result.current.onSelect?.());
    await waitFor(() => expect(importMedia).toHaveBeenCalledOnce());
    if (!returned) {
      expect(onProblem).not.toHaveBeenCalled();
      act(() => push({...failed, phase: 'analysing'}));
      expect(onProblem).not.toHaveBeenCalled();
      act(() => push(failed));
    }

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.lastCall?.[0]).toMatchObject({
      key: `media-view:copy:${failed.mediaId}`,
      meta: [failed.fileName, 'Invented analysis failure'],
    });
  },
);

it('releases the progress subscription and ignores late progress and import replies', async () => {
  let push: (progress: MediaImportProgress) => void = () => undefined;
  let finish: (jobs: readonly MediaImportProgress[]) => void = () => undefined;
  const stop = vi.fn();
  window.llp = mockLlpApi({
    media: {
      subscribeImports: listener => {
        push = listener;
        return stop;
      },
      import: () =>
        new Promise(resolve => {
          finish = value => resolve({ok: true, value});
        }),
    },
  });
  const onProblem = vi.fn();
  const {result, unmount} = renderHook(() => useFileMediaImport(onProblem));
  act(() => result.current.onSelect?.());
  unmount();
  expect(stop).toHaveBeenCalledOnce();
  await act(async () => {
    push(failed);
    finish([failed]);
  });
  expect(onProblem).not.toHaveBeenCalled();
});
