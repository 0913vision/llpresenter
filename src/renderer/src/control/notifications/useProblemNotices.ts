import {useEffect, useEffectEvent} from 'react';
import type {LlpApi} from '@shared/ipc';
import {APP_PROBLEM_LIMITS, type AppProblem} from '@shared/schema/appProblem';
import {noticeTime} from '@renderer/ui/notices';
import type {ControlSession} from '../controlSession';
import {
  WAITING_SAVES_KEY,
  macroDroppedCard,
  skippedFilesCard,
  waitingSavesCard,
} from './problemNotices';

/**
 * Shows the cards for the problems main reports: the standing ones listed
 * once (files skipped before the window loaded, files waiting to be saved)
 * and each one pushed later. A skipped file counts once, however often it
 * arrives, and every file saved closes the 저장할 수 없음 card.
 */
export function useProblemNotices(
  api: Pick<LlpApi, 'problems'> | undefined,
  target: Pick<ControlSession, 'report' | 'dismiss'>,
): void {
  const show = useEffectEvent(target.report);
  const close = useEffectEvent(target.dismiss);
  useEffect(() => {
    if (api === undefined) return undefined;
    const {problems} = api;
    const skipped = new Set<string>();
    let stopped = false;
    const take = (problem: AppProblem): void => {
      if (stopped) return;
      switch (problem.kind) {
        case 'macro-dropped':
          show(macroDroppedCard(problem, noticeTime()));
          return;
        case 'save-failed':
          show(
            waitingSavesCard(problem, {
              time: noticeTime(),
              retry: () => problems.retrySaves(),
            }),
          );
          return;
        case 'save-recovered':
          close(WAITING_SAVES_KEY);
          return;
        case 'file-skipped': {
          if (skipped.has(problem.name)) return;
          if (skipped.size >= APP_PROBLEM_LIMITS.listed) return;
          skipped.add(problem.name);
          const card = skippedFilesCard([...skipped], noticeTime());
          if (card !== null) show(card);
          return;
        }
      }
    };
    const unsubscribe = problems.subscribe(take);
    problems.list().then(
      problems => {
        for (const problem of problems) take(problem);
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
}
