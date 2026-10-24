import {cp, mkdir, rename, rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {Result} from '@shared/result';
import type {Preferences} from '@shared/schema/preferences';
import type {WriteProblem} from './atomicWrite';
import {isMissingFile} from './fsErrors';
import {FOLDER_NAMES, type DataLocations} from './locations';
import {listFolder} from './readFiles';

const PARTIAL_SUFFIX = '.partial';
const KEEP_LIMITS = {min: 1, max: 365} as const;
const BACKUP_NAME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})$/;
const BACKED_UP_FOLDERS = [
  'songs',
  'services',
  'templates',
  'settings',
] as const satisfies ReadonlyArray<keyof DataLocations>;

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

export interface BackupRun {
  readonly locations: DataLocations;
  /** How many backups to keep, 보관; clamped to 1 to 365. */
  readonly keep: number;
  readonly now: Date;
}

export interface BackupsOptions {
  readonly locations: DataLocations;
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
 * because of their size. Never throws.
 */
export async function runBackup({
  locations,
  keep,
  now,
}: BackupRun): Promise<Result<BackupDone, WriteProblem>> {
  const folder = join(locations.backups, backupFolderName(now));
  const partial = `${folder}${PARTIAL_SUFFIX}`;
  try {
    await copyDataFolders(locations, partial);
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
  const names = await listFolder(backupsFolder);
  if (!names.ok) {
    return {
      ok: false,
      error: {file: backupsFolder, message: names.error.message},
    };
  }
  const newest = names.value.filter(isBackupName).at(-1);
  return {ok: true, value: newest === undefined ? null : backupTime(newest)};
}

/** A backup folder's name: the local time, so names sort in time order. */
export function backupFolderName(time: Date): string {
  const date = [time.getFullYear(), time.getMonth() + 1, time.getDate()];
  const clock = [time.getHours(), time.getMinutes(), time.getSeconds()];
  return `${date.map(twoDigits).join('-')} ${clock.map(twoDigits).join('-')}`;
}

async function copyDataFolders(
  locations: DataLocations,
  target: string,
): Promise<void> {
  await rm(target, {recursive: true, force: true});
  await mkdir(target, {recursive: true});
  for (const name of BACKED_UP_FOLDERS) {
    await copyFolder(locations[name], join(target, FOLDER_NAMES[name]));
  }
}

async function copyFolder(source: string, target: string): Promise<void> {
  try {
    await cp(source, target, {
      recursive: true,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
    });
  } catch (error: unknown) {
    if (!isMissingFile(error)) {
      throw error;
    }
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

// NOTE(0913vision): Only names this module writes are ever deleted, so a
// folder the operator put in the backup location is never touched. Every
// leftover `.partial` is from a backup cut off earlier, because backups run
// one at a time.
async function deleteOldBackups(
  backupsFolder: string,
  keep: number,
): Promise<readonly WriteProblem[]> {
  const names = await listFolder(backupsFolder);
  if (!names.ok) {
    return [{file: backupsFolder, message: names.error.message}];
  }
  const complete = names.value.filter(isBackupName);
  const extra = complete.slice(
    0,
    Math.max(0, complete.length - keepCount(keep)),
  );
  const partials = names.value.filter(isPartialName);
  const problems: WriteProblem[] = [];
  for (const name of [...extra, ...partials]) {
    const folder = join(backupsFolder, name);
    try {
      await rm(folder, {recursive: true, force: true});
    } catch (error: unknown) {
      problems.push({file: folder, message: messageOf(error)});
    }
  }
  return problems;
}

function keepCount(keep: number): number {
  const whole = Number.isFinite(keep) ? Math.floor(keep) : KEEP_LIMITS.min;
  return Math.min(KEEP_LIMITS.max, Math.max(KEEP_LIMITS.min, whole));
}

function isBackupName(name: string): boolean {
  return BACKUP_NAME.test(name);
}

function isPartialName(name: string): boolean {
  return (
    name.endsWith(PARTIAL_SUFFIX) &&
    isBackupName(name.slice(0, -PARTIAL_SUFFIX.length))
  );
}

// NOTE(0913vision): A date and time without an offset is local time, which is
// how the name was written.
function backupTime(name: string): Date {
  return new Date(name.replace(BACKUP_NAME, '$1-$2-$3T$4:$5:$6'));
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
