import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {
  APP_PROBLEM_LIMITS,
  fileSkippedProblem,
  saveFailedProblem,
  type AppProblem,
} from '@core/schema/appProblem';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  WAITING_SAVES_KEY,
  skippedFilesCard,
  waitingSavesCard,
} from '@renderer/app/notifications/problemNotices';
import {useProblemNotices} from '@renderer/app/notifications/useProblemNotices';
import type {NoticeTarget} from '@renderer/app/notifications/useOutputNotices';

vi.mock('@renderer/app/notifications/problemNotices', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@renderer/app/notifications/problemNotices')
    >();
  return {
    ...actual,
    skippedFilesCard: vi.fn(actual.skippedFilesCard),
    waitingSavesCard: vi.fn(actual.waitingSavesCard),
  };
});

function setup(
  listed: readonly AppProblem[] | Promise<readonly AppProblem[]> = [],
) {
  let push: (problem: AppProblem) => void = () => undefined;
  const stop = vi.fn();
  const retrySaves = vi.fn<LlpApi['problems']['retrySaves']>();
  const api = mockLlpApi({
    problems: {
      list: () => Promise.resolve(listed),
      retrySaves,
      subscribe: listener => {
        push = listener;
        return stop;
      },
    },
  });
  const target = {
    report: vi.fn<NoticeTarget['report']>(),
    dismiss: vi.fn<NoticeTarget['dismiss']>(),
  };
  const {result} = renderHook(() => useProblemNotices(api, target));
  return {
    result,
    target,
    retrySaves,
    push: (problem: AppProblem): void => act(() => push(problem)),
  };
}

function skippedNames(): readonly string[] | undefined {
  return vi.mocked(skippedFilesCard).mock.lastCall?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useProblemNotices', () => {
  it('shows the runtime warning with the capture-window fallback', async () => {
    const {target} = setup([{kind: 'ndi-runtime-missing'}]);
    await waitFor(() => expect(target.report).toHaveBeenCalled());
    expect(target.report.mock.lastCall?.[0]).toMatchObject({
      title: 'NDI Runtime을 찾을 수 없습니다',
      meta: ['캡처용 창을 사용할 수 있습니다'],
    });
  });
  it('shows the GPU fallback notice', async () => {
    const {target} = setup([{kind: 'ndi-gpu-fallback'}]);
    await waitFor(() => expect(target.report).toHaveBeenCalledOnce());
    expect(target.report.mock.lastCall?.[0]).toMatchObject({
      title: '하드웨어 가속을 쓸 수 없어 일반 방식으로 보냅니다',
    });
  });
  it('clears the GPU fallback notice on recovery', async () => {
    const {target, push} = setup();
    await act(async () => undefined);
    push({kind: 'ndi-gpu-fallback'});
    push({kind: 'ndi-gpu-recovered'});
    expect(target.dismiss).toHaveBeenCalledWith('ndi-gpu-fallback');
  });
  it('does not resurrect a stale GPU warning after recovery', async () => {
    let resolve: (problems: readonly AppProblem[]) => void = () => undefined;
    const pending = new Promise<readonly AppProblem[]>(done => {
      resolve = done;
    });
    const {target, push} = setup(pending);
    push({kind: 'ndi-gpu-recovered'});
    await act(async () => resolve([{kind: 'ndi-gpu-fallback'}]));
    expect(target.report).not.toHaveBeenCalled();
    expect(target.dismiss).toHaveBeenCalledWith('ndi-gpu-fallback');
  });
  it('shows protection warnings independently and clears each after recovery', async () => {
    const {target, push} = setup();
    await act(async () => undefined);
    push({kind: 'protection-write', target: 'record', failed: true});
    push({kind: 'protection-write', target: 'copies', failed: true});
    expect(target.report.mock.calls.map(([notice]) => notice.title)).toEqual([
      '진행 복구 기록 저장 실패',
      '이전 판 저장 실패',
    ]);
    push({kind: 'protection-write', target: 'record', failed: false});
    expect(target.dismiss).toHaveBeenCalledExactlyOnceWith(
      'protection-write:record',
    );
    push({kind: 'protection-write', target: 'copies', failed: false});
    expect(target.dismiss).toHaveBeenLastCalledWith('protection-write:copies');
  });

  it('does not resurrect backup or protection failures from a stale startup list', async () => {
    let resolve: (value: readonly AppProblem[]) => void = () => undefined;
    const initial = new Promise<readonly AppProblem[]>(done => {
      resolve = value => {
        done(value);
      };
    });
    const {target, push} = setup(initial);
    push({kind: 'backup-recovered'});
    push({kind: 'protection-write', target: 'record', failed: false});
    await act(async () =>
      resolve([
        {kind: 'backup-failed', name: 'backup'},
        {kind: 'protection-write', target: 'record', failed: true},
      ]),
    );
    expect(target.report).not.toHaveBeenCalled();
    expect(target.dismiss).toHaveBeenCalledWith('backup-failed');
  });
  it('shows the files skipped before the window loaded as one card', async () => {
    const {target} = setup([
      fileSkippedProblem(1, 'D:/data/settings/themes.json'),
      fileSkippedProblem(2, 'D:/data/Songs/a1.llsong'),
    ]);

    await waitFor(() =>
      expect(skippedNames()).toEqual(['themes.json', 'a1.llsong']),
    );
    expect(target.report.mock.lastCall?.[0].title).toBe('파일 읽기 실패');
  });

  it('counts a file that arrives by push and by the list only once', async () => {
    const {push} = setup([
      fileSkippedProblem(1, 'D:/data/settings/themes.json'),
    ]);
    await waitFor(() => expect(skippedNames()).toEqual(['themes.json']));

    push(fileSkippedProblem(1, 'D:/data/settings/themes.json'));
    expect(skippedFilesCard).toHaveBeenCalledOnce();
    push(fileSkippedProblem(2, 'D:/data/Songs/a1.llsong'));

    expect(skippedNames()).toEqual(['themes.json', 'a1.llsong']);
  });

  it('counts at most the listed limit of skipped files', () => {
    const {push} = setup();

    for (let index = 0; index < APP_PROBLEM_LIMITS.listed + 5; index += 1) {
      push(fileSkippedProblem(index + 1, `D:/data/Songs/${index}.llsong`));
    }

    expect(skippedNames()).toHaveLength(APP_PROBLEM_LIMITS.listed);
  });

  it('counts skipped files by id, even when their names are the same', () => {
    const {push} = setup();
    const stem = '가'.repeat(APP_PROBLEM_LIMITS.nameCharacters);

    push(fileSkippedProblem(1, 'D:/data/Songs/a1.llsong'));
    push(fileSkippedProblem(2, 'D:/backup/Songs/a1.llsong'));
    push(fileSkippedProblem(3, `D:/data/Songs/${stem}1.llsong`));
    push(fileSkippedProblem(4, `D:/data/Songs/${stem}2.llsong`));

    expect(skippedNames()).toHaveLength(4);
  });

  it('keeps a pushed save change over an older one in a list that arrives late', async () => {
    let finishList: (problems: readonly AppProblem[]) => void = () => undefined;
    const lateList = new Promise<readonly AppProblem[]>(resolve => {
      finishList = resolve;
    });
    const {result, target, push} = setup(lateList);
    push(saveFailedProblem('주일 예배', 1));
    push({kind: 'save-recovered'});

    await act(async () => {
      finishList([saveFailedProblem('주일 예배', 1)]);
      await lateList;
    });

    expect(waitingSavesCard).toHaveBeenCalledOnce();
    expect(target.dismiss).toHaveBeenLastCalledWith(WAITING_SAVES_KEY);
    expect(result.current).toBe(false);
  });

  it('shows 저장할 수 없음 with 다시 시도 and closes it when every file is saved', () => {
    const {result, target, retrySaves, push} = setup();

    push(saveFailedProblem('주일 예배', 1));
    expect(result.current).toBe(true);
    expect(target.report.mock.lastCall?.[0].title).toBe('저장 실패');
    vi.mocked(waitingSavesCard).mock.lastCall?.[1].retry();
    expect(retrySaves).toHaveBeenCalledOnce();
    push({kind: 'save-recovered'});

    expect(result.current).toBe(false);
    expect(target.dismiss).toHaveBeenCalledExactlyOnceWith(WAITING_SAVES_KEY);
  });

  it('shows files still waiting to be saved when the window loads', async () => {
    const {result} = setup([saveFailedProblem('주일 예배', 1)]);

    await waitFor(() => expect(result.current).toBe(true));
    expect(waitingSavesCard).toHaveBeenCalledOnce();
  });

  it('shows the backup card for a standing problem and for a push, as one card', async () => {
    const {target, push} = setup([{kind: 'backup-failed', name: '백업'}]);
    await waitFor(() =>
      expect(target.report).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'backup-failed',
          title: '백업 위치를 쓸 수 없습니다',
        }),
      ),
    );
    push({kind: 'backup-failed', name: '백업'});
    expect(target.report).toHaveBeenCalledTimes(2);
    expect(target.report.mock.calls[1]?.[0].key).toBe('backup-failed');
  });

  it('shows the information card when main reports the control window loaded again', () => {
    const {target, push} = setup();
    push({kind: 'control-reloaded'});
    expect(target.report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({key: 'control-reloaded', kind: 'info'}),
    );
  });
});
