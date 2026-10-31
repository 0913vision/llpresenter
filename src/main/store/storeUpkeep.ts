import type {FileError} from '@core/schema/fileFormat';
import {settingsNames} from '@core/schema/settingsDocuments';
import type {Logger} from '../log';
import {Backups, type BackupOutcome} from './backup';
import {type LoadedStore} from './fileStore';
import {dataFileFolders} from './locations';
import {settingsLocation} from './settingsFile';
import {removeStaleTempFiles} from './staleTempFiles';

const MAX_LOGGED_PROBLEMS = 50;

// NOTE(0913vision): Leftover temporary files go before the backup, so a backup
// never copies them.
/**
 * Removes stale temporary files before the launch backup, retaining output-on
 * protection. The caller awaits completion during shutdown; this function does
 * not register a recurring job.
 */
export async function upkeepAtLaunch(
  loading: Promise<LoadedStore | null>,
  isAnyOutputOn: () => boolean,
  log: Logger,
): Promise<void> {
  const store = await loading;
  if (store === null) {
    return;
  }
  await removeLeftoverTempFiles(store, log);
  await backUpAtLaunch(store, isAnyOutputOn, log);
}

async function removeLeftoverTempFiles(
  store: LoadedStore,
  log: Logger,
): Promise<void> {
  for (const name of dataFileFolders) {
    for (const problem of await removeStaleTempFiles(store.locations[name])) {
      log.warn('could not remove a leftover temporary file', problem);
    }
  }
}

async function backUpAtLaunch(
  store: LoadedStore,
  isAnyOutputOn: () => boolean,
  log: Logger,
): Promise<void> {
  try {
    const backups = new Backups({
      locations: store.locations,
      developmentFolder: store.developmentFolder,
      preferences: () => store.preferences.backup,
      isAnyOutputOn,
    });
    logBackupOutcome(await backups.atLaunch(), log);
  } catch (error: unknown) {
    log.error('the launch backup failed', error);
  }
}

// NOTE(0913vision): The songs, 예배 순서, 템플릿, labels, and preferences files
// skipped at startup; the settings problem feed reports the settings and media
// files.
/**
 * Enumerates existing content startup problems, excluding settings and media
 * reported by their own feeds. It does not log, publish or mutate them.
 */
export function contentProblems(store: LoadedStore): readonly FileError[] {
  return store.problems.filter(
    problem =>
      ![...settingsNames, 'media'].some(
        name => settingsLocation(store.locations, name).file === problem.file,
      ),
  );
}

/**
 * Logs the existing loaded-store summary and at most 50 content problems plus
 * the remaining count. It does not repair files or publish problem cards.
 */
export function logLoadedStore(store: LoadedStore, log: Logger): void {
  log.info('read the data folder', {
    dataRoot: store.locations.dataRoot,
    songs: store.songs.size,
    services: store.services.size,
    openServiceId: store.openServiceId,
  });
  const problems = contentProblems(store);
  for (const problem of problems.slice(0, MAX_LOGGED_PROBLEMS)) {
    log.warn('skipped a data file or a part of one', problem);
  }
  const unlogged = problems.length - MAX_LOGGED_PROBLEMS;
  if (unlogged > 0) {
    log.warn(`skipped ${unlogged} more data files or parts of them`);
  }
}

function logBackupOutcome(outcome: BackupOutcome, log: Logger): void {
  switch (outcome.kind) {
    case 'done':
      log.info('backed up the data', {folder: outcome.backup.folder});
      for (const problem of outcome.backup.problems) {
        log.warn('could not delete an old backup', problem);
      }
      return;
    case 'skipped':
      log.info('skipped the launch backup', {reason: outcome.reason});
      return;
    case 'failed':
      log.warn('the launch backup failed', outcome.problem);
      return;
  }
}
