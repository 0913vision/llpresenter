import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {MediaImportProgress} from '@core/schema/mediaEdit';
import {createMediaId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  REPORTED_FAILURES_LIMIT,
  useFileMediaImport,
} from '@renderer/app/shell/useFileMediaImport';
import type {Notice} from '@renderer/ui/notices';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {MediaViewProvider} from '@renderer/features/media/MediaViewProvider';

it.each(['cancel', 'failed', 'complete'] as const)(
  'keeps the workspace until media import completes: %s',
  async outcome => {
    let finish: (jobs: readonly MediaImportProgress[]) => void = () =>
      undefined;
    const listeners = new Set<(job: MediaImportProgress) => void>();
    const progress = (job: MediaImportProgress): void => {
      for (const listener of listeners) listener(job);
    };
    const importMedia = vi.fn(
      () =>
        new Promise<readonly MediaImportProgress[]>(resolve => {
          finish = resolve;
        }),
    );
    const api = mockLlpApi({
      media: {
        import: async () => ({ok: true, value: await importMedia()}),
        subscribeImports: listener => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
    });
    window.llp = api;
    const navigate = vi.fn();
    const {result} = renderHook(() => useFileMediaImport(vi.fn()), {
      wrapper: ({children}) => (
        <WorkspaceNavigation value={navigate}>
          <MediaViewProvider api={api} onProblem={vi.fn()}>
            {children}
          </MediaViewProvider>
        </WorkspaceNavigation>
      ),
    });
    act(() => result.current.onSelect?.());
    expect(importMedia).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    await act(async () =>
      finish(
        outcome === 'cancel' ? [] : [{...failed, phase: 'queued', percent: 0}],
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
    if (outcome !== 'cancel') {
      act(() =>
        progress(
          outcome === 'complete'
            ? {...failed, phase: 'complete', percent: 100}
            : failed,
        ),
      );
    }
    expect(navigate).toHaveBeenCalledTimes(outcome === 'complete' ? 1 : 0);
  },
);

it('explains a missing import connection and a pending import request', async () => {
  delete window.llp;
  const {result, unmount} = renderHook(() => useFileMediaImport(vi.fn()));
  expect(result.current).toMatchObject({
    disabled: true,
    title: '이 창에서는 쓸 수 없음',
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

it('makes one card for one failed import that the push and the reply both report', async () => {
  let push: (progress: MediaImportProgress) => void = () => undefined;
  window.llp = mockLlpApi({
    media: {
      subscribeImports: listener => {
        push = listener;
        return () => undefined;
      },
      import: () => {
        push(failed);
        return Promise.resolve({ok: true as const, value: [failed]});
      },
    },
  });
  const onProblem = vi.fn<(notice: Notice) => void>();
  const {result} = renderHook(() => useFileMediaImport(onProblem));

  act(() => result.current.onSelect?.());

  await waitFor(() => expect(onProblem).toHaveBeenCalled());
  await act(() => Promise.resolve());
  expect(onProblem).toHaveBeenCalledOnce();
});

it('forgets the oldest failed ids across many batches, and still reports a failure once', async () => {
  let push: (progress: MediaImportProgress) => void = () => undefined;
  window.llp = mockLlpApi({
    media: {
      subscribeImports: listener => {
        push = listener;
        return () => undefined;
      },
    },
  });
  const onProblem = vi.fn<(notice: Notice) => void>();
  renderHook(() => useFileMediaImport(onProblem));
  const failure = (index: number): MediaImportProgress => ({
    ...failed,
    mediaId: createMediaId(
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ),
  });
  const total = REPORTED_FAILURES_LIMIT * 3;

  act(() => {
    for (let index = 1; index <= total; index += 1) push(failure(index));
  });
  expect(onProblem).toHaveBeenCalledTimes(total);

  act(() => push(failure(total)));
  expect(onProblem).toHaveBeenCalledTimes(total);

  act(() => push(failure(1)));
  expect(onProblem).toHaveBeenCalledTimes(total + 1);
});

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

it('asks for the file dialog in the same tick as the menu choice', () => {
  const importMedia = vi.fn(() => new Promise<never>(() => {}));
  window.llp = mockLlpApi({media: {import: importMedia}});
  const {result} = renderHook(() => useFileMediaImport(vi.fn()));
  act(() => result.current.onSelect?.());
  expect(importMedia).toHaveBeenCalledOnce();
  expect(importMedia).toHaveBeenCalledWith(
    expect.objectContaining({source: {kind: 'dialog'}}),
  );
});
