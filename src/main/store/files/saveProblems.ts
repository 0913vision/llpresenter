import {appEndpoints} from '@contracts/ipc/app';
import {IpcHost} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import type {ProblemFeed} from '../../base/problemFeed';
import type {SaveFailures} from './saveFailures';

/**
 * Lists the waiting saves on the problem feed, pushes each of their changes,
 * and writes them again on `app:problem:retry-saves` (저장할 수 없음, 다시
 * 시도).
 *
 * @returns A function that removes the source, the subscription, and the
 * retry listener.
 */
export function registerSaveProblems(
  saves: SaveFailures,
  feed: ProblemFeed,
  log: Logger,
): () => void {
  const ipc = new IpcHost(log);
  ipc.whenClosed(
    feed.addStanding(() => [...saves.problems(), ...saves.copyProblems()]),
  );
  ipc.whenClosed(
    saves.subscribe(problem => {
      feed.push(problem);
    }),
  );
  ipc.signal(appEndpoints.retrySaves, () => {
    saves.retry().catch((error: unknown) => {
      log.error('could not retry the waiting saves', error);
    });
  });
  return () => {
    ipc.close();
  };
}
