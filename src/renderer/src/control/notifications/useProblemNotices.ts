import {useEffect, useEffectEvent, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {APP_PROBLEM_LIMITS, type AppProblem} from '@core/schema/appProblem';
import {noticeTime} from '@renderer/ui/notices';
import type {NoticeTarget} from './useOutputNotices';
import {
  WAITING_SAVES_KEY,
  macroDroppedCard,
  skippedFilesCard,
  waitingSavesCard,
} from './problemNotices';

function isSaveProblem(problem: AppProblem): boolean {
  return problem.kind === 'save-failed' || problem.kind === 'save-recovered';
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
    let savePushed = false;
    const take = (problem: AppProblem): void => {
      if (stopped) return;
      switch (problem.kind) {
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
      if (isSaveProblem(problem)) savePushed = true;
      take(problem);
    };
    const fromList = (problem: AppProblem): void => {
      if (savePushed && isSaveProblem(problem)) return;
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
