import {useEffect, useEffectEvent, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {APP_PROBLEM_LIMITS, type AppProblem} from '@core/schema/appProblem';
import {noticeTime} from '@renderer/ui/notices';
import type {NoticeTarget} from './useOutputNotices';
import {
  WAITING_SAVES_KEY,
  BACKUP_FAILED_KEY,
  backupFailedCard,
  controlReloadedCard,
  macroDroppedCard,
  skippedFilesCard,
  waitingSavesCard,
} from './problemNotices';

function problemGroup(problem: AppProblem): string {
  if (problem.kind === 'protection-write') {
    return `${problem.kind}:${problem.target}`;
  }
  if (problem.kind === 'save-failed' || problem.kind === 'save-recovered') {
    return 'save';
  }
  if (problem.kind === 'backup-failed' || problem.kind === 'backup-recovered') {
    return 'backup';
  }
  return problem.kind;
}

/**
 * Shows the cards for the problems main reports: the standing ones listed
 * once (files skipped before the window loaded, files waiting to be saved)
 * and each one pushed later. A skipped file counts once by its id, however
 * often it arrives; every file saved closes the 저장할 수 없음 card; and once
 * a save change has been pushed, the list's older save state is ignored.
 */
export function useProblemNotices(
  api: Pick<LlpApi, 'problems'> | undefined,
  target: Pick<NoticeTarget, 'report' | 'dismiss'>,
): boolean {
  const [saveFailed, setSaveFailed] = useState(false);
  const show = useEffectEvent(target.report);
  const close = useEffectEvent(target.dismiss);
  useEffect(() => {
    if (api === undefined) return undefined;
    const {problems} = api;
    const skipped = new Map<number, string>();
    let stopped = false;
    const pushed = new Set<string>();
    const take = (problem: AppProblem): void => {
      if (stopped) return;
      switch (problem.kind) {
        case 'ndi-runtime-missing':
          show({
            key: 'ndi-runtime-missing',
            kind: 'warning',
            icon: 'warning',
            time: noticeTime(),
            title: 'NDI Runtime을 찾을 수 없습니다',
            meta: ['캡처용 창을 사용할 수 있습니다'],
          });
          return;
        case 'ndi-gpu-fallback':
          show({
            key: 'ndi-gpu-fallback',
            kind: 'warning',
            icon: 'warning',
            time: noticeTime(),
            title: '하드웨어 가속을 쓸 수 없어 일반 방식으로 보냅니다',
          });
          return;
        case 'ndi-failed':
          show({
            key: 'ndi-failed',
            kind: 'warning',
            icon: 'warning',
            time: noticeTime(),
            title: 'NDI 출력 실패',
            meta: ['캡처용 창으로 표시 중'],
          });
          return;
        case 'protection-write': {
          const key = problemGroup(problem);
          if (!problem.failed) close(key);
          else {
            show({
              key,
              kind: 'warning',
              icon: 'warning',
              time: noticeTime(),
              title:
                problem.target === 'record'
                  ? '진행 복구 기록 저장 실패'
                  : '이전 판 저장 실패',
            });
          }
          return;
        }
        case 'backup-recovered':
          close(BACKUP_FAILED_KEY);
          return;
        case 'macro-dropped':
          show(macroDroppedCard(problem, noticeTime()));
          return;
        case 'save-failed':
          setSaveFailed(true);
          show(
            waitingSavesCard(problem, {
              time: noticeTime(),
              retry: () => problems.retrySaves(),
            }),
          );
          return;
        case 'control-reloaded':
          show(controlReloadedCard(noticeTime()));
          return;
        case 'backup-failed':
          show(backupFailedCard(problem, noticeTime()));
          return;
        case 'save-recovered':
          setSaveFailed(false);
          close(WAITING_SAVES_KEY);
          return;
        case 'file-skipped': {
          if (skipped.has(problem.fileId)) return;
          if (skipped.size >= APP_PROBLEM_LIMITS.listed) return;
          skipped.set(problem.fileId, problem.name);
          const card = skippedFilesCard([...skipped.values()], noticeTime());
          if (card !== null) show(card);
          return;
        }
      }
    };
    const fromPush = (problem: AppProblem): void => {
      pushed.add(problemGroup(problem));
      take(problem);
    };
    const fromList = (problem: AppProblem): void => {
      if (
        (problem.kind === 'protection-write' ||
          problemGroup(problem) === 'save' ||
          problemGroup(problem) === 'backup') &&
        pushed.has(problemGroup(problem))
      ) {
        return;
      }
      take(problem);
    };
    const unsubscribe = problems.subscribe(fromPush);
    problems.list().then(
      listed => {
        for (const problem of listed) fromList(problem);
      },
      // NOTE(0913vision): The preload logs a failed or malformed list before
      // it rejects; later pushes still arrive.
      () => undefined,
    );
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [api]);
  return saveFailed;
}
