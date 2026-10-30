import {ipcMain} from 'electron';
import {Channels} from '@contracts/ipc/api';
import type {Logger} from '../log';
import type {ProblemFeed} from '../problemFeed';
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
  const removeStanding = feed.addStanding(() => saves.problems());
  const stop = saves.subscribe(problem => {
    feed.push(problem);
  });
  const retry = (): void => {
    saves.retry().catch((error: unknown) => {
      log.error('could not retry the waiting saves', error);
    });
  };
  ipcMain.on(Channels.appProblemRetrySaves, retry);
  return () => {
    ipcMain.removeListener(Channels.appProblemRetrySaves, retry);
    stop();
    removeStanding();
  };
}
