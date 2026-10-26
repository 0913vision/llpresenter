import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {Logger} from '../log';
import {broadcast} from './contentChannels';
import type {SaveFailures} from './saveFailures';

/**
 * Answers `app:problem:list` with the standing problems, sends each change of
 * the waiting saves to the windows, and writes them again on
 * `app:problem:retry-saves` (저장할 수 없음, 다시 시도).
 *
 * @returns A function that removes the handlers and the subscription.
 */
export function registerProblemChannels(
  saves: SaveFailures,
  log: Logger,
): () => void {
  ipcMain.handle(Channels.appProblemList, () => saves.problems());
  const retry = (): void => {
    saves.retry().catch((error: unknown) => {
      log.error('could not retry the waiting saves', error);
    });
  };
  ipcMain.on(Channels.appProblemRetrySaves, retry);
  const stop = saves.subscribe(problem => {
    broadcast(Channels.appProblem, problem, log);
  });
  return () => {
    ipcMain.removeHandler(Channels.appProblemList);
    ipcMain.removeListener(Channels.appProblemRetrySaves, retry);
    stop();
  };
}
