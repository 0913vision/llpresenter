import {cp, mkdir, readdir, realpath, rename, rm, stat} from 'node:fs/promises';
import {basename, join} from 'node:path';
import type {Result} from '@shared/result';
import type {Preferences} from '@shared/schema/preferences';
import {isTemporaryFileName, type WriteProblem} from './atomicWrite';
import {isMissingFile} from './fsErrors';
import {
  dataFileFolders,
  FOLDER_NAMES,
  isInside,
  type DataLocations,
} from './locations';

const PARTIAL_SUFFIX = '.partial';
const KEEP_LIMITS = {min: 1, max: 365} as const;
const BACKUP_NAME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})(\d{2})$/;

/** A finished backup, and the old backups it couldn't delete. */
export interface BackupDone {
  readonly folder: string;
  readonly problems: readonly WriteProblem[];
}

export type BackupSkipReason =
  'auto-off' | 'output-on' | 'done-today' | 'running';

/** What a request for a backup did. */
export type BackupOutcome =
  | {readonly kind: 'done'; readonly backup: BackupDone}
  | {readonly kind: 'skipped'; readonly reason: BackupSkipReason}
  | {readonly kind: 'failed'; readonly problem: WriteProblem};

interface BackupFolders {
  readonly complete: readonly string[];
  readonly partial: readonly string[];
}

export interface BackupRun {
  readonly locations: DataLocations;
  /** How many backups to keep, 보관; clamped to 1 to 365. */
  readonly keep: number;
  readonly now: Date;
  /** The `LLP_USER_DATA` folder that nothing copied may lead out of, or `null`. */
  readonly developmentFolder: string | null;
}

export interface BackupsOptions {
  readonly locations: DataLocations;
  /** The `LLP_USER_DATA` folder that nothing copied may lead out of, or `null`. */
  readonly developmentFolder: string | null;
  /** 자동 백업 and 보관 from 환경설정, read when a backup starts. */
  readonly preferences: () => Preferences['backup'];
  readonly isAnyOutputOn: () => boolean;
  readonly now?: () => Date;
}

/**
 * Starts backups one at a time, and never while an output is on, because
 * backups don't run during a service.
 */
export class Backups {
  private running = false;
  private readonly now: () => Date;

  constructor(private readonly options: BackupsOptions) {
    this.now = options.now ?? (() => new Date());
  }

  /**
   * The backup at launch: once a day, when 자동 백업 is on and no output is
   * on. The caller runs it once per launch, so a failure waits for the next
   * launch or 지금 백업 instead of retrying.
   */
  async atLaunch(): Promise<BackupOutcome> {
    if (!this.options.preferences().auto) {
      return {kind: 'skipped', reason: 'auto-off'};
    }
    const lastBackup = await lastBackupTime(this.options.locations.backups);
    if (!lastBackup.ok) {
      return {kind: 'failed', problem: lastBackup.error};
    }
    if (lastBackup.value !== null && isSameDay(lastBackup.value, this.now())) {
      return {kind: 'skipped', reason: 'done-today'};
    }
    return this.run();
  }

  /** 지금 백업: a backup now, unless an output is on. */
  backUpNow(): Promise<BackupOutcome> {
    return this.run();
  }

  private async run(): Promise<BackupOutcome> {
    if (this.options.isAnyOutputOn()) {
      return {kind: 'skipped', reason: 'output-on'};
    }
    if (this.running) {
      return {kind: 'skipped', reason: 'running'};
    }
    this.running = true;
    try {
      const backup = await runBackup({
        locations: this.options.locations,
        keep: this.options.preferences().keep,
        now: this.now(),
        developmentFolder: this.options.developmentFolder,
      });
      return backup.ok
        ? {kind: 'done', backup: backup.value}
        : {kind: 'failed', problem: backup.error};
    } finally {
      this.running = false;
    }
  }
}

/**
 * Copies the songs, 예배 순서, 틀, and settings folders into a new backup
 * folder named after the local time, then deletes the oldest backups past
 * `keep`. The copy goes into `<time>.partial` first and is renamed once
 * complete, so a backup cut off halfway never counts. Media files are left out
 * because of their size. In development, a link that leads outside
 * `LLP_USER_DATA` fails the backup. Never throws.
 */
export async function runBackup({
  locations,
  keep,
  now,
  developmentFolder,
}: BackupRun): Promise<Result<BackupDone, WriteProblem>> {
  const folder = join(locations.backups, backupFolderName(now));
  const partial = `${folder}${PARTIAL_SUFFIX}`;
  const staged = await createStaging(locations.backups, partial);
  if (!staged.ok) {
    return {ok: false, error: {file: folder, message: staged.error}};
  }
  try {
    await copyDataFolders(locations, partial, developmentFolder);
    await rename(partial, folder);
  } catch (error: unknown) {
    return {ok: false, error: await failedBackup(folder, partial, error)};
  }
  const problems = await deleteOldBackups(locations.backups, keep);
  return {ok: true, value: {folder, problems}};
}

/**
 * The time of the newest complete backup in a folder, from its name, or
 * `null` when there is none. Nothing else records it, so `app.json` keeps a
 * single writer.
 */
export async function lastBackupTime(
  backupsFolder: string,
): Promise<Result<Date | null, WriteProblem>> {
  const folders = await backupFolders(backupsFolder);
  if (!folders.ok) {
    return folders;
  }
  const newest = folders.value.complete.at(-1);
  return {ok: true, value: newest === undefined ? null : backupTime(newest)};
}

/**
 * A backup folder's name: the local time as `YYYY-MM-DD HHmmss`, so names
 * sort in time order (spec 02, "Automatic backup").
 */
export function backupFolderName(time: Date): string {
  const date = [time.getFullYear(), time.getMonth() + 1, time.getDate()];
  const clock = [time.getHours(), time.getMinutes(), time.getSeconds()];
  return `${date.map(twoDigits).join('-')} ${clock.map(twoDigits).join('')}`;
}

// NOTE(0913vision): The staging folder is created, never taken over, so a file
// or a link already at its name fails the backup and is left as it is. Only a
// staging folder this run created is ever removed.
async function createStaging(
  backupsFolder: string,
  partial: string,
): Promise<Result<void, string>> {
  try {
    await mkdir(backupsFolder, {recursive: true});
    await mkdir(partial);
    return {ok: true, value: undefined};
  } catch (error: unknown) {
    return {ok: false, error: messageOf(error)};
  }
}

async function copyDataFolders(
  locations: DataLocations,
  target: string,
  developmentFolder: string | null,
): Promise<void> {
  const allowed = await copyFilter(developmentFolder);
  for (const name of dataFileFolders) {
    await copyFolder(
      locations[name],
      join(target, FOLDER_NAMES[name]),
      allowed,
    );
  }
}

// NOTE(0913vision): A write's temporary file is never copied: a leftover of a
// cut-off write, or a write running now, isn't data, even when the launch
// cleanup leaves it because it is fresh. Links are copied as what they point
// to, so in development the real path of every file and folder is checked
// against `LLP_USER_DATA` before it is copied; a link under 곡 that leads to
// real data fails the backup.
async function copyFilter(
  developmentFolder: string | null,
): Promise<(source: string) => Promise<boolean>> {
  const root =
    developmentFolder === null ? null : await realpath(developmentFolder);
  return async source => {
    if (isTemporaryFileName(basename(source))) {
      return false;
    }
    if (root !== null && !isInside(await realpath(source), root)) {
      throw new Error(`Refused: ${source} leads outside LLP_USER_DATA`);
    }
    return true;
  };
}

// NOTE(0913vision): Links are copied as what they point to, so a backup never
// depends on the data it backs up. Only a source folder that doesn't exist,
// such as 틀 before the first 틀, is skipped; any other failure fails the
// backup, so an incomplete one never counts.
async function copyFolder(
  source: string,
  target: string,
  allowed: (source: string) => Promise<boolean>,
): Promise<void> {
  if (!(await isExistingFolder(source))) {
    return;
  }
  await cp(source, target, {
    recursive: true,
    dereference: true,
    errorOnExist: true,
    force: false,
    preserveTimestamps: true,
    filter: allowed,
  });
}

async function isExistingFolder(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    if (!stats.isDirectory()) {
      throw new Error(`Expected a folder: ${path}`);
    }
    return true;
  } catch (error: unknown) {
    if (isMissingFile(error)) {
      return false;
    }
    throw error;
  }
}

async function failedBackup(
  folder: string,
  partial: string,
  error: unknown,
): Promise<WriteProblem> {
  const message = messageOf(error);
  try {
    await rm(partial, {recursive: true, force: true});
    return {file: folder, message};
  } catch (cleanupError: unknown) {
    const cleanup = `${partial} was left behind: ${messageOf(cleanupError)}`;
    return {file: folder, message: `${message}; ${cleanup}`};
  }
}

async function deleteOldBackups(
  backupsFolder: string,
  keep: number,
): Promise<readonly WriteProblem[]> {
  const folders = await backupFolders(backupsFolder);
  if (!folders.ok) {
    return [folders.error];
  }
  const {complete, partial} = folders.value;
  const extra = complete.slice(
    0,
    Math.max(0, complete.length - keepCount(keep)),
  );
  const problems: WriteProblem[] = [];
  for (const name of [...extra, ...partial]) {
    const folder = join(backupsFolder, name);
    try {
      await rm(folder, {recursive: true, force: true});
    } catch (error: unknown) {
      problems.push({file: folder, message: messageOf(error)});
    }
  }
  return problems;
}

// NOTE(0913vision): Only real folders whose names this module writes count, so
// a file, a link, or a folder the operator put in the backup location is never
// read as a backup or deleted. Every leftover `.partial` is from a backup cut
// off earlier, because backups run one at a time.
async function backupFolders(
  backupsFolder: string,
): Promise<Result<BackupFolders, WriteProblem>> {
  try {
    const folders = (await readdir(backupsFolder, {withFileTypes: true}))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
    return {
      ok: true,
      value: {
        complete: folders.filter(isBackupName),
        partial: folders.filter(isPartialName),
      },
    };
  } catch (error: unknown) {
    return isMissingFile(error)
      ? {ok: true, value: {complete: [], partial: []}}
      : {ok: false, error: {file: backupsFolder, message: messageOf(error)}};
  }
}

function keepCount(keep: number): number {
  const whole = Number.isFinite(keep) ? Math.floor(keep) : KEEP_LIMITS.min;
  return Math.min(KEEP_LIMITS.max, Math.max(KEEP_LIMITS.min, whole));
}

function isBackupName(name: string): boolean {
  const time = backupTime(name);
  return time !== null && backupFolderName(time) === name;
}

function isPartialName(name: string): boolean {
  return (
    name.endsWith(PARTIAL_SUFFIX) &&
    isBackupName(name.slice(0, -PARTIAL_SUFFIX.length))
  );
}

// NOTE(0913vision): A date and time without an offset is local time, which is
// how the name was written. A name like 2026-13-40 makes an invalid date, and a
// valid date that doesn't write back to the same name is refused by
// `isBackupName`.
function backupTime(name: string): Date | null {
  if (!BACKUP_NAME.test(name)) {
    return null;
  }
  const time = new Date(name.replace(BACKUP_NAME, '$1-$2-$3T$4:$5:$6'));
  return Number.isNaN(time.getTime()) ? null : time;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
